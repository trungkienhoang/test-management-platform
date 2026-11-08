import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { MailModule } from './mail/mail.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { TestSuitesModule } from './test-suites/test-suites.module.js';
import { TestCasesModule } from './test-cases/test-cases.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TestSuitesModule,
    TestCasesModule,
  ],
})
export class AppModule {}
