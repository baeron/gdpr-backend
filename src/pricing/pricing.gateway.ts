import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PricingService } from './pricing.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
  },
  namespace: '/pricing',
})
export class PricingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PricingGateway.name);

  constructor(private readonly pricingService: PricingService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Client subscribes to pricing updates for a specific region
   */
  @SubscribeMessage('subscribe')
  async handleSubscribe(client: Socket, payload: { region: string }) {
    const { region } = payload;
    
    // Join room for this region
    client.join(`region:${region}`);
    
    this.logger.log(`Client ${client.id} subscribed to region ${region}`);
    
    // Send current pricing immediately
    const pricing = await this.pricingService.getCurrentPricing(region as any);
    client.emit('pricing-update', pricing);
    
    return { success: true, region };
  }

  /**
   * Client unsubscribes from pricing updates
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, payload: { region: string }) {
    const { region } = payload;
    client.leave(`region:${region}`);
    this.logger.log(`Client ${client.id} unsubscribed from region ${region}`);
    return { success: true, region };
  }

  /**
   * Broadcast pricing update to all clients subscribed to a region
   * Called by PricingService after a purchase
   */
  async broadcastPricingUpdate(region: string) {
    const pricing = await this.pricingService.getCurrentPricing(region as any);
    this.server.to(`region:${region}`).emit('pricing-update', pricing);
    this.logger.log(`Broadcasted pricing update for region ${region}: €${pricing.currentPrice}`);
  }

  /**
   * Broadcast to all regions
   */
  async broadcastAllRegions() {
    const allPricing = await this.pricingService.getAllRegionsPricing();
    
    for (const [region, pricing] of Object.entries(allPricing)) {
      this.server.to(`region:${region}`).emit('pricing-update', pricing);
    }
    
    this.logger.log('Broadcasted pricing updates to all regions');
  }
}
