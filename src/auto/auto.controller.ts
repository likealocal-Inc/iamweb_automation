import { Controller, Get, Render } from '@nestjs/common';
import { AutoService } from './auto.service';

@Controller('auto')
export class AutoController {
  constructor(private readonly autoService: AutoService) {}

  @Get()
  @Render('index')
  root() {
    return { message: 'Hello World!' };
  }

  @Get('logfiles')
  @Render('logFiles')
  async logFileList() {
    return { files: await this.autoService.getLogFileList() };
  }
}
