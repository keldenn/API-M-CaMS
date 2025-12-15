import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorporateActionsController } from './corporate-actions.controller';
import { CorporateActionsService } from './corporate-actions.service';
import { CorporateActions } from '../entities/corporate-actions.entity';
import { Agms } from '../entities/agms.entity';
import { Scripts } from '../entities/scripts.entity';
import { Symbol } from '../entities/symbol.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CorporateActions, Agms, Scripts], 'financial'),
    TypeOrmModule.forFeature([Symbol], 'default'),
  ],
  controllers: [CorporateActionsController],
  providers: [CorporateActionsService],
  exports: [CorporateActionsService],
})
export class CorporateActionsModule {}
