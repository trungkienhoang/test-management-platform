import { Module } from '@nestjs/common';
import { TestSuitesService } from './test-suites.service.js';
import { TestSuitesController } from './test-suites.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [TestSuitesController],
  providers: [TestSuitesService],
  exports: [TestSuitesService],
})
export class TestSuitesModule {}
