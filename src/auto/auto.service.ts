import { Injectable } from '@nestjs/common';
import { LogUtil } from '../libs/utils/log.utils';

@Injectable()
export class AutoService {
  async getLogFileList(): Promise<string[]> {
    return await new LogUtil().getLogFileList();
  }
}
