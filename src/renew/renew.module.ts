import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkUser } from '../entities/linkuser.entity';
import { User } from '../entities/user.entity';
import { RenewController } from './renew.controller';
import { RenewService } from './renew.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, LinkUser], 'cms22')],
  controllers: [RenewController],
  providers: [RenewService],
})
export class RenewModule {}
