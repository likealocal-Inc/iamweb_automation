import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IamwebOrderGoogleModel } from '../libs/utils/iamweb.utils';
import { PrismaService } from 'src/config/prisma/prisma.service';
import { GoogleSheetName } from '../libs/utils/google.utils';
import { IamwebUtils } from '../libs/utils/iamweb.utils';
import {
  AutoScheduleUtils,
  OrderStatus,
  endProcessStatus,
} from '../libs/utils/auto.schedule.utils';

@Injectable()
export class AutoSchedule {
  iamwebUtil: IamwebUtils;
  autoScheduleUtil: AutoScheduleUtils;
  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {
    this.iamwebUtil = new IamwebUtils(this.httpService);
    this.autoScheduleUtil = new AutoScheduleUtils(this.httpService);
  }

  /**
   * 아이엠웹 주문데이터 조회 -> 구글시트에 작성
   */
  @Cron('0 10 * * * *')
  async imwebSearch() {
    // 주문리스트조회 -> 아임웹에서 조회
    const list: IamwebOrderGoogleModel[] = await this.iamwebUtil.getOrderList();

    //주문 항목이 있을 경우 처리
    if (list !== undefined) {
      for (let index = 0; index < list.length; index++) {
        // 현재까지 저장된 셀넘버를 가져옴(1증가한 새로운 값)
        const newCellNum: number =
          await this.autoScheduleUtil.readNewGoogleSheetLineNumber(
            GoogleSheetName.iamweb,
          );

        // 주문데이터
        const iamwebOrderData: IamwebOrderGoogleModel = list[index];

        // 트랜잭션시작
        await this.prisma.$transaction(async (prisma) => {
          // 동일 주문번호가 있는지 확인
          const res = await prisma.iamwebOrder.findUnique({
            where: { iamwebOrderId: iamwebOrderData.order_no },
          });

          // 주문데이터가 없으면 처리
          if (!res) {
            // 구글 시트에 데이터 추가하고 해당 추가 데이터를 스트링으로 반환
            const googleLine: string =
              await this.autoScheduleUtil.googleSheetUpdateAndGetLineStringData(
                newCellNum,
                iamwebOrderData,
              );

            // 주문정보 DB에 저장
            await prisma.iamwebOrder.create({
              data: {
                iamwebOrderId: iamwebOrderData.order_no,
                googleId: newCellNum.toString(),
                status: OrderStatus.GOOGLE_SHEET_WRITE,
                orderData: googleLine,
              },
            });

            //최종 셀넘버를 저장
            await this.autoScheduleUtil.writeGoogleSheetLineNumber(
              newCellNum,
              GoogleSheetName.iamweb,
            );

            // 새로운 주문에 대한 알림
            await this.autoScheduleUtil.sendMessageNewOrder(
              newCellNum,
              iamwebOrderData,
            );
          }
        });
      }
    }
  }

  // 상품문의 조회
  // @Cron('*/10 * * * * *')
  async iamwebRequest() {
    const res = await this.iamwebUtil.getIamwebRequest();
    console.log(res);
  }

  /**
   * 진모빌리티 작성 데이터 확인
   */
  @Cron('0 30 * * * *')
  async imwebProcessCheck() {
    // DB에서 구글ID조회(완료가 아닌것)
    const iamwebOrders = await this.prisma.iamwebOrder.findMany({
      where: {
        NOT: {
          status: {
            in: endProcessStatus,
          },
        },
      },
    });

    for (let index = 0; index < iamwebOrders.length; index++) {
      const order = iamwebOrders[index];
      const status = await this.autoScheduleUtil.readOrderStatus(
        order['googleId'],
      );

      // undefined -> 아무런 입력값이 없음
      // db와 같은 상태값이면 변경되지 않음
      if (status === undefined) {
        continue;
      } else {
        // 구글라인데이터 가져옴
        const lineData =
          await this.autoScheduleUtil.googleSheetOrderLineFullRead(
            order['googleId'],
          );

        // 해당 데이터를 String으로 만듦
        const data = await this.autoScheduleUtil.getGoogleLineArrToString(
          lineData[0],
        );

        // 현재데이터와 DB에 데이터가 동일하면 변경안됨
        if (data !== order['orderData']) {
          // 변경된 데이터 DB에 업데이트
          await this.prisma.iamwebOrder.update({
            where: { id: order['id'] },
            data: { status: status[0][0], orderData: data },
          });

          // 데이터 변경 알림
          await this.autoScheduleUtil.sendMessageChangeData(data, order);

          // 로그파일에 저장
          await this.autoScheduleUtil.saveLog(
            data,
            lineData,
            `id-${order['googleId']}.log`,
          );
        }
      }
    }
  }
}
