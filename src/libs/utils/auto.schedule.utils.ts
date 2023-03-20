import { HttpService } from '@nestjs/axios';
import { DateUtil, MomentDate } from './date.utils';
import { GoogleUtils, GoogleSheetName } from './google.utils';
import { IamwebOrderGoogleModel, IamwebUtils } from './iamweb.utils';
import { SlackUtil, SlackAlertType } from './slack.utils';
import { IamwebOrder } from '@prisma/client';
import { LogUtil } from './log.utils';

export enum OrderStatus {
  INIT = 'INIT',
  GOOGLE_SHEET_WRITE = '구글시트에작성',
  DISPATCH_ING = '확인중', // 확인중
  DISPATCH_COMPLETE = '배차완료', // 배차완료
  DISPATCH_CANCEL = '취소', // 취소
  DISPATCH_NO = '미배차', // 미배차
  DISPATCH_JINI_CHANGE = '지니변경', //지니변경
  DISPATCH_BOOK_CHANGE = '예약변경 확인완료', // 예약변경 확인완료
  DISPATCH_PRE = '예정', //예정
  DISPATCH_WAITING = '대기중', // 대기중
  DISPATCH_DONE = '종료', //종료
}

// 종료 상태값
export const endProcessStatus = [
  OrderStatus.DISPATCH_DONE,
  OrderStatus.DISPATCH_CANCEL,
];

export class AutoScheduleUtils {
  logUtil: LogUtil;
  googleSheetUtil: GoogleUtils;
  slackUtil: SlackUtil;
  iamwebUtil: IamwebUtils;
  constructor(private readonly httpService: HttpService) {
    this.logUtil = new LogUtil();
    this.googleSheetUtil = new GoogleUtils();
    this.slackUtil = new SlackUtil(this.httpService);
    this.iamwebUtil = new IamwebUtils(this.httpService);
  }

  /**
   * 구글시트라인 배열 -> 스트링으로 변환 (|로 붙입)
   * @param googleLineArr
   * @returns
   */
  async getGoogleLineArrToString(googleLineArr: string[]): Promise<string> {
    return googleLineArr.join('|');
  }

  async __makeGoogleSheetLine(
    orderData: IamwebOrderGoogleModel,
    cellNum: number,
  ): Promise<any[]> {
    const yyyy_mm_dd = new DateUtil().YYYYMMDD(orderData.order_time, '-');
    const hh_mm_dd = new DateUtil().HHMMSS(orderData.order_time, ':');

    const productNo = orderData.product_item.items.prod_no;
    const productType: string = await this.iamwebUtil.getProductType(
      Number(productNo),
    );

    const formData = orderData.form;
    let memos = '';
    let bookDateTime = '';

    for (let index = 0; index < formData.length; index++) {
      const el = formData[index];
      memos =
        memos +
        `[${el.title === undefined ? '' : el.title}] | ${
          el.value === undefined ? '' : el.value
        } \r\n`;

      if (el.title === '탑승 일자' || el.title === '탑승 시간') {
        bookDateTime += el.value + ' ';
      }
    }

    const jsonData = [
      (cellNum - 5).toString(),
      yyyy_mm_dd,
      hh_mm_dd,
      '',
      '',
      '라이크어로컬',
      '02-2055-3130',
      productType,
      '', //대절시간
      orderData.orderer.name, //이용자명
      '02-2055-3130', // 이용자 연락처
      bookDateTime,
      orderData.product_item.items.startLocation,
      orderData.product_item.items.endLocation,
      memos,
    ];

    return jsonData;
  }

  /**
   * 라인에 해당하는 데이터 조회
   * @param cellNum
   * @returns
   */
  async readGoogleLine(cellNum: string): Promise<string> {
    const arrData: any[][] = await this.googleSheetOrderLineFullRead(cellNum);
    return this.getGoogleLineArrToString(arrData[0]);
  }

  // 구글 시트에 데이터 저장
  async googleSheetUpdateAndGetLineStringData(
    cellNum: number,
    orderData: IamwebOrderGoogleModel,
  ): Promise<string> {
    const jsonData = await this.__makeGoogleSheetLine(orderData, cellNum);

    await this.googleSheetUtil.updateGoogleSheet(
      `B${cellNum}`,
      `P${cellNum}`,
      [jsonData],
      GoogleSheetName.iamweb,
    );

    return this.getGoogleLineArrToString(jsonData);
  }

  /**
   * 라인넘버읽기
   * @returns
   */
  async readGoogleSheetLineNumber(sheetName: GoogleSheetName): Promise<number> {
    const context = await this.googleSheetUtil.readGoogleSheet(
      'A1',
      'A1',
      sheetName,
    );
    return Number(context[0][0]);
  }

  /**
   * 읽는 셀번호 새 번호 가져오기
   * @param sheetName
   * @returns
   */
  async readNewGoogleSheetLineNumber(
    sheetName: GoogleSheetName,
  ): Promise<number> {
    const context = await this.googleSheetUtil.readGoogleSheet(
      'A1',
      'A1',
      sheetName,
    );
    const newCellNum = Number(context[0][0]) + 1;
    return newCellNum;
  }

  /**
   * 현재까지 읽은 라인넘버 저장
   * @param num
   */
  async writeGoogleSheetLineNumber(num: number, sheetName: GoogleSheetName) {
    this.googleSheetUtil.updateGoogleSheet(
      'A1',
      'A1',
      [[num.toString()]],
      sheetName,
    );
  }

  /**
   * 새로운 주문에 대한 알림 메세지
   * @param newCellNum
   * @param orderData
   */
  async sendMessageNewOrder(
    newCellNum: number,
    orderData: IamwebOrderGoogleModel,
  ) {
    await this.slackUtil.send(
      SlackAlertType.IAMWEB_ORDER,
      `New Order[sheet_no:${newCellNum}, order_no:${orderData.order_no}]`,
    );
  }

  // 진모빌리티에서 작성한 상태값 확인
  async readOrderStatus(cellNum: string): Promise<any[][]> {
    return await this.googleSheetUtil.readGoogleSheet(
      `Q${cellNum}`,
      `Q${cellNum}`,
      GoogleSheetName.iamweb,
    );
  }

  /**
   * 구글시트에 로그 데이터 저장
   * @param time
   * @param data
   */
  async logGoogleSheet(time: string, data: any[][]) {
    const cellNum: number = await this.readNewGoogleSheetLineNumber(
      GoogleSheetName.log,
    );
    const newDatat = [[time, ...data[0]]];
    await this.googleSheetUtil.updateGoogleSheet(
      `B${cellNum}`,
      `Z${cellNum}`,
      newDatat,
      GoogleSheetName.log,
    );
    this.writeGoogleSheetLineNumber(cellNum, GoogleSheetName.log);
  }

  /**
   * 구글 라인 데이터 읽기
   * @param cellNum
   * @returns
   */
  async googleSheetOrderLineFullRead(cellNum: string): Promise<any[][]> {
    return await this.googleSheetUtil.readGoogleSheet(
      `B${cellNum}`,
      `Y${cellNum}`,
      GoogleSheetName.iamweb,
    );
  }

  /**
   * 변경 데이터에 대한 알림
   * @param data
   * @param order
   */
  async sendMessageChangeData(data: string, order: IamwebOrder) {
    this.slackUtil.send(
      SlackAlertType.ORDER_DISPATCH_DATA_CHANGE,
      `Change Dispatch Status: no[${Number(order['googleId']) - 5}] before - ${
        order['orderData']
      }, now - ${data}}`,
    );
  }

  /**
   * 로그파일 저장
   * @param data
   * @param fileName
   */
  async saveLog(data: string, googleLine: any[][], fileName: string) {
    const time = MomentDate.nowString('YYYY/MM/DD hh:mm:ss');
    data = '[' + time + ']' + data;

    await this.logUtil.save(data, fileName);
    await this.logGoogleSheet(time, googleLine);
  }
}
