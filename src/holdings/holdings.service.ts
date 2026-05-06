import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import { CdsHolding } from '../entities/cds-holding.entity';
import { Symbol } from '../entities/symbol.entity';
import { BboFinance } from '../entities/bbo-finance.entity';
import { MarketPrice } from '../entities/market-price.entity';
import { ClientAccount } from '../entities/client-account.entity';
import { HoldingsResponseDto } from './dto/holdings-response.dto';
import { PortfolioStatsDto } from './dto/portfolio-stats.dto';

@Injectable()
export class HoldingsService {
  constructor(
    @InjectRepository(CdsHolding)
    private cdsHoldingRepository: Repository<CdsHolding>,
    @InjectRepository(Symbol)
    private symbolRepository: Repository<Symbol>,
    @InjectRepository(BboFinance)
    private bboFinanceRepository: Repository<BboFinance>,
    @InjectRepository(MarketPrice)
    private marketPriceRepository: Repository<MarketPrice>,
    @InjectRepository(ClientAccount)
    private clientAccountRepository: Repository<ClientAccount>,
    private readonly configService: ConfigService,
  ) {}

  async sendPortfolioStatement(cdCode: string): Promise<string> {
    try {
      const client = await this.clientAccountRepository.findOne({
        where: { cd_code: cdCode },
      });

      if (!client) {
        throw new Error('Client account not found');
      }

      const email = client.email?.trim();
      if (!email) {
        throw new Error('No email found for this client account');
      }

      const holdings = await this.getStatementHoldingsByCdCode(cdCode);
      const pdfBuffer = await this.generateStatementPdf(client, holdings);
      await this.sendStatementEmail(email, pdfBuffer);

      return email;
    } catch (error) {
      console.error('Error sending portfolio statement:', error);
      throw new Error('Failed to generate and send portfolio statement');
    }
  }

  async getHoldingsByCdCode(cdCode: string): Promise<HoldingsResponseDto[]> {
    try {
      const query = `
        SELECT 
          s.symbol, 
          s.security_type,
          h.volume, 
          h.pending_out_vol, 
          h.pending_in_vol, 
          h.pledge_volume, 
          h.block_volume,
          (h.volume + h.pending_out_vol + h.pledge_volume + h.block_volume) as total
        FROM cds_holding h 
        JOIN symbol s ON h.symbol_id = s.symbol_id 
        WHERE h.cd_code = ? 
        AND s.status = 1
      `;

      const result = await this.cdsHoldingRepository.query(query, [cdCode]);

      if (!result || result.length === 0) {
        return [];
      }

      return result.map((row) => ({
        symbol: row.symbol,
        security_type: row.security_type,
        volume: parseFloat(row.volume) || 0,
        pending_out_vol: parseFloat(row.pending_out_vol) || 0,
        pending_in_vol: parseFloat(row.pending_in_vol) || 0,
        pledge_volume: parseFloat(row.pledge_volume) || 0,
        block_volume: parseFloat(row.block_volume) || 0,
        total: parseFloat(row.total) || 0,
      }));
    } catch (error) {
      console.error('Error fetching holdings:', error);
      throw new Error('Failed to fetch holdings data');
    }
  }

  async getPortfolioStats(username: string): Promise<PortfolioStatsDto> {
    try {
      const query = `
        SELECT 
          SUM(CASE WHEN f.status = 1 THEN f.amount ELSE 0 END) AS totExposure,
          SUM(CASE WHEN f.status = 1 AND f.flag = 3 THEN f.amount * -1 ELSE 0 END) AS totbuy,
          SUM(CASE WHEN f.status = 1 AND f.flag = 2 THEN f.amount ELSE 0 END) AS totsell,
          (
            SELECT COUNT(*) 
            FROM cds_holding h 
            JOIN symbol s ON s.symbol_id = h.symbol_id
            JOIN linkuser lu2 ON h.cd_code = lu2.client_code 
            WHERE lu2.username = ? 
              AND h.volume > 0
              AND s.status = 1
              AND s.security_type = 'OS'
          ) AS total_holdings_count,
          (
            SELECT COALESCE(SUM(h.volume * mp.market_price), 0)
            FROM cds_holding h
            JOIN symbol s ON s.symbol_id = h.symbol_id
            JOIN linkuser lu3 ON h.cd_code = lu3.client_code
            JOIN (
              SELECT mp1.symbol_id, mp1.market_price
              FROM market_price mp1
              INNER JOIN (
                SELECT symbol_id, MAX(date) AS latest_date
                FROM market_price
                GROUP BY symbol_id
              ) latest
                ON latest.symbol_id = mp1.symbol_id
                AND latest.latest_date = mp1.date
            ) mp ON mp.symbol_id = h.symbol_id
            WHERE lu3.username = ?
              AND h.volume > 0
              AND s.status = 1
              AND s.security_type = 'OS'
          ) AS current_market_value
        FROM bbo_finance f
        JOIN linkuser l ON l.client_code = f.cd_code
        WHERE l.username = ?
      `;

      const result = await this.marketPriceRepository.query(query, [
        username,
        username,
        username,
      ]);
      const stats = result[0] || {};

      return {
        totExposure: parseFloat(stats.totExposure) || 0,
        totbuy: parseFloat(stats.totbuy) || 0,
        totsell: parseFloat(stats.totsell) || 0,
        total_holdings_count: parseInt(stats.total_holdings_count) || 0,
        current_market_value: parseFloat(stats.current_market_value) || 0,
      };
    } catch (error) {
      console.error('Error fetching portfolio stats:', error);
      throw new Error('Failed to fetch portfolio statistics');
    }
  }

  private async getStatementHoldingsByCdCode(cdCode: string): Promise<
    {
      cd_code: string;
      symbol: string;
      pledge_volume: number;
      block_volume: number;
      total: number;
    }[]
  > {
    const query = `
      SELECT
        h.cd_code,
        s.symbol,
        h.pledge_volume,
        h.block_volume,
        (h.volume + h.pledge_volume + h.block_volume + h.pending_in_vol + h.pending_out_vol) AS total
      FROM cds_holding h
      JOIN symbol s ON h.symbol_id = s.symbol_id
      WHERE h.cd_code = ?
        AND s.status = 1
        AND (h.volume + h.pledge_volume + h.block_volume + h.pending_in_vol + h.pending_out_vol) > 0
      ORDER BY s.symbol ASC
    `;

    const rows = await this.cdsHoldingRepository.query(query, [cdCode]);
    return rows.map((row) => ({
      cd_code: row.cd_code,
      symbol: row.symbol,
      pledge_volume: Number(row.pledge_volume) || 0,
      block_volume: Number(row.block_volume) || 0,
      total: Number(row.total) || 0,
    }));
  }

  private async generateStatementPdf(
    client: ClientAccount,
    holdings: {
      cd_code: string;
      symbol: string;
      pledge_volume: number;
      block_volume: number;
      total: number;
    }[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];
      const now = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Thimphu',
        hour12: false,
      });

      doc.on('data', (chunk) => buffers.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(16).text('Royal Securities Exchange of Bhutan', {
        align: 'center',
      });
      doc.moveDown(0.3);
      doc.fontSize(11).text('Account Summary Details', { align: 'center' });
      doc.fontSize(10).text(`Report generated on: ${now}`, { align: 'center' });
      doc.moveDown();

      doc.fontSize(10);
      doc.text(`CID/DISN/CD CODE : ${client.ID || '-'}`);
      doc.text(`NAME : ${client.f_name || ''} ${client.l_name || ''}`.trim());
      doc.text(`TPN No : ${client.tpn || '-'}`);
      doc.text(`ADDRESS : ${client.address || '-'}`);
      doc.moveDown();

      const startX = 40;
      const colWidths = [40, 220, 90, 90, 90];
      const headers = [
        'Sl#',
        'CD Code/Symbol',
        'Block Vol',
        'Pledged Vol',
        'Total Volume',
      ];

      let currentY = doc.y;
      doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), 24).stroke();

      let xCursor = startX;
      headers.forEach((header, i) => {
        if (i > 0) {
          doc
            .moveTo(xCursor, currentY)
            .lineTo(xCursor, currentY + 24)
            .stroke();
        }
        doc.fontSize(9).text(header, xCursor + 4, currentY + 7, {
          width: colWidths[i] - 8,
          align: i === 0 ? 'center' : 'left',
        });
        xCursor += colWidths[i];
      });

      currentY += 24;
      holdings.forEach((item, index) => {
        const rowHeight = 22;
        doc
          .rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight)
          .stroke();

        let rowX = startX;
        const values = [
          String(index + 1),
          `${item.cd_code} - ${item.symbol}`,
          item.block_volume.toLocaleString(),
          item.pledge_volume.toLocaleString(),
          item.total.toLocaleString(),
        ];

        values.forEach((value, i) => {
          if (i > 0) {
            doc
              .moveTo(rowX, currentY)
              .lineTo(rowX, currentY + rowHeight)
              .stroke();
          }
          doc.fontSize(9).text(value, rowX + 4, currentY + 6, {
            width: colWidths[i] - 8,
            align: i === 0 ? 'center' : i > 1 ? 'right' : 'left',
          });
          rowX += colWidths[i];
        });

        currentY += rowHeight;
      });

      doc.moveDown(2);
      doc
        .fontSize(10)
        .text('THIS IS A COMPUTER GENERATED REPORT AND REQUIRES NO SIGNATORY', {
          align: 'center',
        });

      doc.end();
    });
  }

  private async sendStatementEmail(email: string, pdfBuffer: Buffer): Promise<void> {
    const smtpPort = Number(this.configService.get<number>('SMTP_PORT') || 587);
    const isSecure = smtpPort === 465;

    const transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com',
      port: smtpPort,
      secure: isSecure,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    const fromAddress =
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('SMTP_USER') ||
      'noreply@example.com';

    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: 'Share Statement',
      html: `
        Dear Sir/Madam, <br><br>
        Please find attached your share statement.<br><br><br>
        <p style="color: red; font-size: 16px; font-weight: bold;">
          *** This is an automatically generated email, please do not reply. ***
        </p>
        <hr><strong><i>
        Royal Securities Exchange of Bhutan<br>
        Post Box No. 742<br>
        Email:rseb@rsebl.org.bt<br>
        Phone No.+975-02-323849
        </i></strong><hr>
      `,
      attachments: [
        {
          filename: 'ShareStatement.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }
}
