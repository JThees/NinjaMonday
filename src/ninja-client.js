/**
 * NinjaRMM API Client
 */
import axios from 'axios';

export class NinjaClient {
  constructor(clientId, clientSecret, baseUrl = 'https://app.ninjarmm.com') {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl;
    this.apiUrl = `${baseUrl}/api/v2`;
    this.tokenUrl = `${baseUrl}/ws/oauth/token`;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get or refresh OAuth access token
   */
  async getAccessToken() {
    // Return cached token if still valid (with 60 second buffer)
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    const response = await axios.post(
      this.tokenUrl,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'monitoring'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

    return this.accessToken;
  }

  /**
   * Get all ticket boards
   */
  async getTicketBoards() {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `${this.apiUrl}/ticketing/trigger/boards`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    return response.data;
  }

  /**
   * Get tickets from a specific board
   * @param {number} boardId - Board ID
   */
  async getTicketsFromBoard(boardId) {
    const token = await this.getAccessToken();

    const response = await axios.post(
      `${this.apiUrl}/ticketing/trigger/board/${boardId}/run`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // The response has {data: [], metadata: {}}
    return response.data.data || [];
  }

  /**
   * Get all tickets from all boards
   * @param {Array<number>} boardIds - Optional array of board IDs to fetch. If not provided, fetches from all boards.
   */
  async getAllTickets(boardIds = null) {
    const boards = await this.getTicketBoards();

    // Filter to specific boards if requested
    const boardsToFetch = boardIds
      ? boards.filter(b => boardIds.includes(b.id))
      : boards;

    let allTickets = [];
    const ticketIds = new Set(); // Track unique tickets by ID

    for (const board of boardsToFetch) {
      try {
        const tickets = await this.getTicketsFromBoard(board.id);

        // Deduplicate tickets that appear in multiple boards
        for (const ticket of tickets) {
          if (!ticketIds.has(ticket.id)) {
            ticketIds.add(ticket.id);
            allTickets.push(ticket);
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not fetch tickets from board ${board.name} (${board.id}):`, error.message);
      }
    }

    return allTickets;
  }

  /**
   * Get ticket form attributes (custom fields)
   */
  async getTicketFormAttributes() {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `${this.apiUrl}/ticketing/attributes`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    return response.data;
  }

  /**
   * Get ticket forms
   */
  async getTicketForms() {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `${this.apiUrl}/ticketing/ticket-form`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    return response.data;
  }

  /**
   * Get a single ticket by ID
   * @param {number} ticketId - Ticket ID
   */
  async getTicket(ticketId) {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `${this.apiUrl}/ticketing/ticket/${ticketId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    return response.data;
  }
}
