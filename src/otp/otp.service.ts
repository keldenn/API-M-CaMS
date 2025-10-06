import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SmsOtpLog } from '../entities/sms-otp-log.entity';
import { SendOtpDto, SendOtpResponseDto } from './dto/send-otp.dto';
import { VerifyOtpDto, VerifyOtpResponseDto } from './dto/verify-otp.dto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(SmsOtpLog)
    private smsOtpLogRepository: Repository<SmsOtpLog>,
    private configService: ConfigService,
  ) {}

  async sendOtp(sendOtpDto: SendOtpDto): Promise<SendOtpResponseDto> {
    const { email, phone_no } = sendOtpDto;

    try {
      // Generate 6-digit OTP
      const otpNo = Math.floor(100000 + Math.random() * 900000);
      const message = `Your OTP is ${otpNo}`;
      const emailMessage = `Your OTP is ${otpNo}. Please do not share this OTP with anyone for security reasons.`;

      // Insert OTP into database
      const otpLog = this.smsOtpLogRepository.create({
        phone_no: phone_no ? parseInt(phone_no) : null,
        email: email || null,
        otp_no: otpNo,
        message: message,
        status: 0,
      } as SmsOtpLog);

      const insertResult = await this.smsOtpLogRepository.save(otpLog);

      if (insertResult) {
        let smsSuccess = false;
        let emailSuccess = false;

        // Send SMS if phone number provided
        if (phone_no) {
          smsSuccess = await this.sendSms(phone_no, message);
        }

        // Send Email if email provided
        if (email) {
          emailSuccess = await this.sendEmail(email, emailMessage);
        }

        // Determine response based on delivery success
        if (smsSuccess && emailSuccess) {
          return {
            error: false,
            message: 'Successfully sent OTP via SMS and email',
            data: 'SENT',
          };
        } else if (smsSuccess && !email) {
          return {
            error: false,
            message: 'Successfully sent OTP via SMS',
            data: 'SENT',
          };
        } else if (emailSuccess && !phone_no) {
          return {
            error: false,
            message: 'Successfully sent OTP via email',
            data: 'SENT',
          };
        } else {
          const failedMethods: string[] = [];
          if (phone_no && !smsSuccess) failedMethods.push('SMS');
          if (email && !emailSuccess) failedMethods.push('email');
          
          return {
            error: true,
            message: `OTP was generated but delivery failed for ${failedMethods.join(' and ')}`,
            data: '',
          };
        }
      } else {
        return {
          error: true,
          message: 'Failed to generate OTP.',
          data: '',
        };
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      return {
        error: true,
        message: 'An error occurred while sending OTP',
        data: '',
      };
    }
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
    const { phone_no, otp } = verifyOtpDto;

    try {
      // Find latest unverified OTP for the phone number
      const latest = await this.smsOtpLogRepository
        .createQueryBuilder('otp')
        .where('otp.phone_no = :phone', { phone: parseInt(phone_no) })
        .andWhere('otp.status = :status', { status: 0 })
        .orderBy('otp.id', 'DESC')
        .limit(1)
        .getOne();

      if (!latest) {
        return {
          error: true,
          message: 'No OTP found for this phone number or it has already been used',
          data: '',
        };
      }

      // Check OTP expiration (6 minutes from created_date)
      const now = new Date();
      const otpCreatedTime = new Date(latest.created_date);
      const expirationTime = new Date(otpCreatedTime.getTime() + 6 * 60 * 1000); // 6 minutes in milliseconds

      if (now > expirationTime) {
        // Mark expired OTP as used to prevent reuse
        await this.smsOtpLogRepository.update({ id: latest.id }, { status: 1 });
        
        return {
          error: true,
          message: 'OTP expired',
          data: '',
        };
      }

      // Compare OTP
      if (String(latest.otp_no) !== String(otp)) {
        return {
          error: true,
          message: 'Invalid OTP',
          data: '',
        };
      }

      // Mark OTP as used (status = 1)
      await this.smsOtpLogRepository.update({ id: latest.id }, { status: 1 });

      return {
        error: false,
        message: 'OTP verified successfully',
        data: 'VERIFIED',
      };
    } catch (error) {
      console.error('Verify OTP error:', error);
      return {
        error: true,
        message: 'An error occurred while verifying OTP',
        data: '',
      };
    }
  }

  private async sendSms(phoneNo: string, message: string): Promise<boolean> {
    try {
      // Hardcoded SMS configuration (no environment variables needed)
      const token = 'rsebsms@2021#Dec!';
      const url = 'https://cms.rsebl.org.bt/api/v1/rseb_sms_gateway.php';
      
      const formData = new URLSearchParams();
      formData.append('phoneNo', phoneNo);
      formData.append('message', message);
      formData.append('token', token);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const result = await response.text();
      return result === 'SENT';
    } catch (error) {
      console.error('SMS sending error:', error);
      return false;
    }
  }

  private async sendEmail(email: string, message: string): Promise<boolean> {
    try {
      // Create transporter (you can configure this based on your email service)
      const transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com',
        port: this.configService.get<number>('SMTP_PORT') || 587,
        secure: false,
        auth: {
          user: this.configService.get<string>('SMTP_USER'),
          pass: this.configService.get<string>('SMTP_PASS'),
        },
      });

      const mailOptions = {
        from: this.configService.get<string>('SMTP_FROM') || 'noreply@example.com',
        to: email,
        subject: 'Your OTP Code',
        text: message,
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Email sending error:', error);
      return false;
    }
  }
}
