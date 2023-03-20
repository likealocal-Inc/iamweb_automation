import { Module } from '@nestjs/common';
import { AutoModule } from './auto/auto.module';
import { PrismaModule } from './config/prisma/prisma.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    AutoModule,
    PrismaModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'files'),
    }),
  ],
})
export class AppModule {}
