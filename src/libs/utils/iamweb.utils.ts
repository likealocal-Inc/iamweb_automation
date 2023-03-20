import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosResponse } from 'axios';
import { Observable, catchError, firstValueFrom } from 'rxjs';

enum ProductType {
  privateTaxi = 133,
  pickup = 83,
  sanding = 122,
  tPickup = 146,
  tSanding = 147,
  tPrivateTaxi = 148,
}

export class IamwebUtils {
  constructor(private readonly httpService: HttpService) {}

  /**
   * 액세스 토큰 조회
   * @returns
   */
  async __getAcessToken() {
    const res: Observable<AxiosResponse<any, any>> = this.httpService.get(
      'https://api.imweb.me/v2/auth?key=07a74245318a9b532978b77a98630c3679a91eaecf&secret=1f6f033a9feb1368463038',
    );

    const { data } = await firstValueFrom(
      res.pipe(
        catchError((err: AxiosError) => {
          throw 'Error' + err;
        }),
      ),
    );

    return data;
  }

  async __getIamwebRequest(accessToken: string) {
    const url = 'https://api.imweb.me/v2/shop/inquirys';
    const { data } = await firstValueFrom(
      this.httpService
        .get(url, { headers: { 'access-token': accessToken } })
        .pipe(),
    );
    return data;
  }

  async __getIamwebOrderItemList(accessToken: string, orderId: string) {
    const url = `https://api.imweb.me/v2/shop/orders/${orderId}/prod-orders`;
    const { data } = await firstValueFrom(
      this.httpService
        .get(url, { headers: { 'access-token': accessToken } })
        .pipe(),
    );

    if (data.code === -11) return;

    return new IamwebProductModel(data.data[0]);
  }

  async __getIamwebOrderList(
    accessToken: string,
    startTimeStatmp: string,
    endTimeStatmp: string,
  ) {
    const { data } = await firstValueFrom(
      this.httpService
        .get('https://api.imweb.me/v2/shop/orders', {
          headers: { 'access-token': accessToken },
          params: {
            order_date_from: startTimeStatmp.substring(0, 10),
            order_date_to: endTimeStatmp.substring(0, 10),
          },
        })
        .pipe(),
    );

    return data;
  }

  async getProductType(productNo: number) {
    /**
     * 상품
     * 프라이빗택시: 133
     * 인천/김포공항 픽업: 83 - 편도
     * 샌딩: 122 - 편도
     */
    console.log(productNo);
    console.log(ProductType.privateTaxi);

    switch (productNo) {
      case ProductType.privateTaxi:
      case ProductType.tPrivateTaxi:
        return '대절';
      case ProductType.pickup:
      case ProductType.sanding:
      case ProductType.tSanding:
      case ProductType.tPickup:
        return '편도';
    }
    return '상품번호오류';
  }

  async getIamwebRequest(): Promise<any> {
    const tokenRes = await this.__getAcessToken();
    if (tokenRes['code'] === 200) {
      const res = await this.__getIamwebRequest(tokenRes['access_token']);
      return res;
    }
    return;
  }

  /**
   * Iamweb 주문 데이터 조회
   * @param accessToken
   * @returns
   */
  async getIamwebOrderList(
    startTimeStatmp: string,
    endTimeStatmp: string,
  ): Promise<Array<IamwebOrderGoogleModel>> {
    const tokenRes = await this.__getAcessToken();
    if (tokenRes['code'] === 200) {
      const listRes = await this.__getIamwebOrderList(
        tokenRes['access_token'],
        startTimeStatmp,
        endTimeStatmp,
      );
      if (listRes['code'] === 200) {
        const list = listRes['data']['list'];
        const result = [];
        for (let index = 0; index < list.length; index++) {
          const element = list[index];

          const model: IamwebOrderGoogleModel = new IamwebOrderGoogleModel(
            element,
          );
          const product = await this.__getIamwebOrderItemList(
            tokenRes['access_token'],
            model.order_no,
          );

          if (product === undefined) return;

          model.product_item = product;

          result.push(model);
        }
        return result;
      }
    }
    return;
  }

  // 주문리스트 조회
  async getOrderList(): Promise<IamwebOrderGoogleModel[]> {
    const today = new Date();
    const fromDay = new Date(today);
    fromDay.setDate(today.getDate() - 2);

    // 주문리스트를 조회
    return await this.getIamwebOrderList(
      fromDay.valueOf().toString(),
      today.valueOf().toString(),
    );
  }
}

export class IamwebProductModel {
  code;
  order_no;
  status;
  claim_status;
  claim_type;
  pay_time = -1;
  delivery_time = -1;
  complete_time = -1;
  parcel_code;
  invoice_no;
  items = {
    no: '',
    prod_no: '',
    prod_name: '',
    prod_custom_code: '',
    prod_sku_no: '',
    payment: {
      count: '',
      price: '',
      price_tax_free: '',
      deliv_price_tax_free: '',
      deliv_price: '',
      island_price: '',
      price_sale: '',
      point: '',
      coupon: '',
      membership_discount: '',
      period_discount: '',
    },
    delivery: {
      deliv_code: '',
      deliv_price_mix: '',
      deliv_group_code: '',
      deliv_type: '',
      deliv_pay_type: '',
      deliv_price_type: '',
    },
    startLocation: '',
    endLocation: '',
  };

  constructor(data: any) {
    this.code = data.code;
    this.order_no = data.order_no;
    this.status = data.status;
    this.claim_status = data.claim_status;
    this.claim_type = data.claim_type;
    this.pay_time = data.pay_time;
    this.delivery_time = data.delivery_time;
    this.complete_time = data.complete_time;
    this.parcel_code = data.parcel_code;
    this.invoice_no = data.invoice_no;

    const items = data.items[0];
    this.items.no = items.no;
    this.items.prod_no = items.prod_no;
    this.items.prod_name = items.prod_name;
    this.items.prod_custom_code = items.prod_custom_code;
    this.items.prod_sku_no = items.prod_sku_no;

    this.items.payment.count = items.payment.count;
    this.items.payment.price = items.payment.price;
    this.items.payment.price_tax_free = items.payment.price_tax_free;
    this.items.payment.deliv_price_tax_free =
      items.payment.deliv_price_tax_free;
    this.items.payment.deliv_price = items.payment.deliv_price;
    this.items.payment.island_price = items.payment.island_price;
    this.items.payment.price_sale = items.payment.price_sale;
    this.items.payment.point = items.payment.point;
    this.items.payment.coupon = items.payment.coupon;
    this.items.payment.membership_discount = items.payment.membership_discount;
    this.items.payment.period_discount = items.payment.period_discount;

    this.items.delivery.deliv_code = items.delivery.deliv_code;
    this.items.delivery.deliv_price_mix = items.delivery.deliv_price_mix;
    this.items.delivery.deliv_group_code = items.delivery.deliv_group_code;
    this.items.delivery.deliv_type = items.delivery.deliv_type;
    this.items.delivery.deliv_pay_type = items.delivery.deliv_pay_type;
    this.items.delivery.deliv_price_type = items.delivery.deliv_price_type;

    if (items.options !== undefined) {
      const options = items.options[0][0].value_name_list;

      // 서울 -> 공항
      if (this.items.prod_no.toString() === ProductType.tSanding.toString()) {
        this.items.startLocation = options[0] + '/' + options[2];
        this.items.endLocation = options[1];
      }
      // 공항 -> 서울
      else if (
        this.items.prod_no.toString() === ProductType.tPickup.toString()
      ) {
        this.items.endLocation = options[0] + '/' + options[2];
        this.items.startLocation = options[1];
      } else if (
        this.items.prod_no.toString() === ProductType.tPrivateTaxi.toString()
      ) {
        this.items.startLocation = options[0] + '[' + options[1] + ']';
        this.items.endLocation = options[2] + '[' + options[3] + ']';
      }
    } else {
      this.items.startLocation = '';
      this.items.endLocation = '';
    }
  }
}

export class IamwebOrderGoogleModel {
  order_no;
  order_type;
  device = {
    type: '',
  };
  order_time = -1;
  complete_time = -1;
  orderer = {
    member_code: '',
    name: '',
    email: '',
    call: '',
    call2: '',
  };
  delivery = {
    country: '',
    country_text: '',
    address: {
      name: '',
      phone: '',
      phone2: '',
      postcode: '',
      address: '',
      address_detail: '',
      address_street: '',
      address_building: '',
      address_city: '',
      address_state: '',
      logistics_type: '',
    },
    memo: '',
  };
  payment = {
    pay_type: '',
    pg_type: '',
    deliv_type: '',
    deliv_pay_type: '',
    price_currency: '',
    total_price: '',
    deliv_price: '',
  };
  form = new Array<IamwebOrderFormModel>();

  product_item: IamwebProductModel;

  constructor(data: any) {
    this.order_no = data.order_no;
    this.order_type = data.order_type;

    this.device.type = data.device.type;
    this.order_time = data.order_time;
    this.complete_time = data.complete_time;

    this.orderer.member_code = data.orderer.member_code;
    this.orderer.name = data.orderer.name;
    this.orderer.email = data.orderer.email;
    this.orderer.call = data.orderer.call;
    this.orderer.call2 = data.orderer.call2;

    this.delivery.country = data.delivery.country;
    this.delivery.country_text = data.delivery.country_text;

    this.delivery.address.name = data.delivery.address.name;
    this.delivery.address.phone = data.delivery.address.phone;
    this.delivery.address.phone2 = data.delivery.address.phone2;
    this.delivery.address.postcode = data.delivery.address.postcode;
    this.delivery.address.address = data.delivery.address.address;
    this.delivery.address.address_detail = data.delivery.address.address_detail;
    this.delivery.address.address_street = data.delivery.address.address_street;
    this.delivery.address.address_building =
      data.delivery.address.address_building;
    this.delivery.address.address_city = data.delivery.address.address_city;
    this.delivery.address.address_state = data.delivery.address.address_state;
    this.delivery.address.logistics_type = data.delivery.address.logistics_type;
    this.delivery.memo = data.delivery.memo;

    this.payment.pay_type = data.payment.pay_type;
    this.payment.pg_type = data.payment.pg_type;
    this.payment.deliv_type = data.payment.deliv_type;
    this.payment.deliv_pay_type = data.payment.deliv_pay_type;
    this.payment.price_currency = data.payment.price_currency;
    this.payment.total_price = data.payment.total_price;
    this.payment.deliv_price = data.payment.deliv_price;

    for (let index = 0; index < data.form.length; index++) {
      const d = data.form[index];
      const form: IamwebOrderFormModel = new IamwebOrderFormModel(d);

      this.form.push(form);
    }
  }
}

export class IamwebOrderFormModel {
  type;
  title;
  desc;
  value;
  form_config_value;
  constructor(data: any) {
    this.type = data.type;
    this.title = data.title;
    this.desc = data.desc;
    this.value = data.value;
    this.form_config_value = data.form_config_value;
  }
}
