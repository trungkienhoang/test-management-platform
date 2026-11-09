import { Module } from '@nestjs/common';
import { TestRunsController } from './test-runs.controller.js';
import { TestRunsService } from './test-runs.service.js';
import { TestExecutionsService } from './test-executions.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [TestRunsController],
  providers: [TestRunsService, TestExecutionsService],
  exports: [TestRunsService, TestExecutionsService],
})
export class TestRunsModule {}
