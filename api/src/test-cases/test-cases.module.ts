import { Module } from '@nestjs/common';
import { TestCasesService } from './test-cases.service.js';
import { TestCasesController } from './test-cases.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [TestCasesController],
  providers: [TestCasesService],
  exports: [TestCasesService],
})
export class TestCasesModule {}
