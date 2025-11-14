/**
 * Monday.com API Client
 */
import axios from 'axios';

export class MondayClient {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.apiUrl = 'https://api.monday.com/v2';
    this.headers = {
      'Authorization': apiToken,
      'Content-Type': 'application/json',
      'API-Version': '2024-10'
    };
  }

  /**
   * Execute a GraphQL query
   */
  async query(queryString, variables = {}) {
    const response = await axios.post(
      this.apiUrl,
      {
        query: queryString,
        variables
      },
      { headers: this.headers }
    );

    if (response.data.errors) {
      throw new Error(`Monday.com GraphQL error: ${JSON.stringify(response.data.errors)}`);
    }

    return response.data.data;
  }

  /**
   * Get all items from a board with pagination
   * @param {string} boardId - Board ID
   * @param {number} limit - Items per page (max 100)
   */
  async getBoardItems(boardId, limit = 100) {
    let allItems = [];
    let cursor = null;
    let hasMore = true;

    while (hasMore) {
      const cursorParam = cursor ? `, cursor: "${cursor}"` : '';

      const queryString = `query {
        boards(ids: [${boardId}]) {
          items_page(limit: ${limit}${cursorParam}) {
            cursor
            items {
              id
              name
              column_values {
                id
                column {
                  id
                  title
                }
                type
                text
                value
              }
            }
          }
        }
      }`;

      const data = await this.query(queryString);
      const itemsPage = data.boards[0].items_page;

      allItems = allItems.concat(itemsPage.items);

      // Check if there are more pages
      cursor = itemsPage.cursor;
      hasMore = itemsPage.items.length === limit && cursor !== null;
    }

    return allItems;
  }

  /**
   * Get board columns structure
   * @param {string} boardId - Board ID
   */
  async getBoardColumns(boardId) {
    const queryString = `query {
      boards(ids: [${boardId}]) {
        id
        name
        columns {
          id
          title
          type
          settings_str
        }
      }
    }`;

    const data = await this.query(queryString);
    return data.boards[0].columns;
  }

  /**
   * Get all existing Ninja Ticket IDs from Tickets board
   * @param {string} boardId - Tickets board ID
   * @param {string} ninjaTicketIdColumnId - Column ID for Ninja Ticket ID
   */
  async getExistingNinjaTicketIds(boardId, ninjaTicketIdColumnId) {
    const items = await this.getBoardItems(boardId);
    const existingIds = new Set();

    for (const item of items) {
      const ninjaIdColumn = item.column_values.find(cv => cv.id === ninjaTicketIdColumnId);
      if (ninjaIdColumn && ninjaIdColumn.text) {
        existingIds.add(ninjaIdColumn.text.trim());
      }
    }

    return existingIds;
  }

  /**
   * Get the next item number by finding the largest integer item name
   * @param {string} boardId - Board ID
   * @returns {number} Next item number to use
   */
  async getNextItemNumber(boardId) {
    const items = await this.getBoardItems(boardId);
    let maxNumber = 0;

    for (const item of items) {
      const itemNumber = parseInt(item.name, 10);
      if (!isNaN(itemNumber) && itemNumber > maxNumber) {
        maxNumber = itemNumber;
      }
    }

    return maxNumber + 1;
  }

  /**
   * Get existing tags from a tags column
   * @param {string} boardId - Board ID
   * @param {string} columnId - Tags column ID
   * @returns {Map} Map of tag name -> tag ID
   */
  async getExistingTags(boardId, columnId) {
    const columns = await this.getBoardColumns(boardId);
    const tagsColumn = columns.find(col => col.id === columnId);

    const tagMap = new Map();

    if (tagsColumn && tagsColumn.settings_str) {
      const settings = JSON.parse(tagsColumn.settings_str);
      if (settings.tags) {
        for (const [tagId, tagData] of Object.entries(settings.tags)) {
          tagMap.set(tagData.name, parseInt(tagId));
        }
      }
    }

    return tagMap;
  }

  /**
   * Create or get a tag using Monday.com's create_or_get_tag mutation
   * @param {string} boardId - Board ID
   * @param {string} tagName - Name of the tag to create/get
   * @returns {number} The ID of the tag
   */
  async createOrGetTag(boardId, tagName) {
    const mutation = `mutation {
      create_or_get_tag(tag_name: "${tagName}", board_id: ${boardId}) {
        id
      }
    }`;

    const result = await this.query(mutation);
    return parseInt(result.create_or_get_tag.id);
  }

  /**
   * Get or create tags and return their IDs
   * @param {string} boardId - Board ID
   * @param {Array<string>} tagNames - Array of tag names
   * @param {Map} existingTags - Map of existing tag name -> ID (will be updated)
   * @returns {Array<number>} Array of tag IDs
   */
  async ensureTags(boardId, tagNames, existingTags) {
    const tagIds = [];

    for (const tagName of tagNames) {
      if (existingTags.has(tagName)) {
        // Tag exists in cache, use its ID
        tagIds.push(existingTags.get(tagName));
      } else {
        // Create or get the tag
        const tagId = await this.createOrGetTag(boardId, tagName);
        existingTags.set(tagName, tagId); // Update cache
        tagIds.push(tagId);
      }
    }

    return tagIds;
  }

  /**
   * Create a new item in a board (NOT IMPLEMENTED IN DRY-RUN)
   * @param {string} boardId - Board ID
   * @param {string} itemName - Item name
   * @param {object} columnValues - Column values object
   */
  async createItem(boardId, itemName, columnValues) {
    const columnValuesJson = JSON.stringify(columnValues)
      .replace(/"/g, '\\"');

    const queryString = `mutation {
      create_item(
        board_id: ${boardId},
        item_name: "${itemName}",
        column_values: "${columnValuesJson}"
      ) {
        id
        name
      }
    }`;

    const data = await this.query(queryString);
    return data.create_item;
  }

  /**
   * Update column values for an existing item
   * @param {string} boardId - Board ID
   * @param {string} itemId - Item ID to update
   * @param {object} columnValues - Column values object
   */
  async updateItem(boardId, itemId, columnValues) {
    const columnValuesJson = JSON.stringify(columnValues)
      .replace(/"/g, '\\"');

    const queryString = `mutation {
      change_multiple_column_values(
        board_id: ${boardId},
        item_id: ${itemId},
        column_values: "${columnValuesJson}"
      ) {
        id
        name
      }
    }`;

    const data = await this.query(queryString);
    return data.change_multiple_column_values;
  }
}
