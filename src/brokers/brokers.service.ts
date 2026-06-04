import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdmParticipant } from '../entities/adm-participant.entity';
import { BrokerResponseDto } from './dto/broker-response.dto';

@Injectable()
export class BrokersService {
  constructor(
    @InjectRepository(AdmParticipant, 'cms22')
    private readonly admParticipantRepository: Repository<AdmParticipant>,
  ) {}

  async findAllActive(): Promise<BrokerResponseDto[]> {
    const brokers = await this.admParticipantRepository.find({
      where: { status: 1 },
      select: {
        participant_code: true,
        address: true,
        institution_id: true,
        phone: true,
        email: true,
        name: true,
      },
      order: { name: 'ASC' },
    });

    return brokers.map((broker) => ({
      participant_code: broker.participant_code,
      address: broker.address,
      institution_id: Number(broker.institution_id),
      phone: Number(broker.phone),
      email: broker.email,
      name: broker.name,
    }));
  }
}
