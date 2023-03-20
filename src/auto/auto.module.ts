import { Module } from '@nestjs/common';
import { AutoService } from './auto.service';
import { AutoController } from './auto.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { AutoSchedule } from './auto.schedule';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../config/prisma/prisma.module';

@Module({
  imports: [ScheduleModule.forRoot(), HttpModule, PrismaModule],
  controllers: [AutoController],
  providers: [AutoService, AutoSchedule],
})
export class AutoModule {}
