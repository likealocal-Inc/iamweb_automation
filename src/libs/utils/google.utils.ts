import { google, sheets_v4 } from 'googleapis';
// import { client_email, private_key } from '../../../google.config.dev.json';

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_SHEET_client_email;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_SHEET_private_key;

export enum GoogleSheetDirecftion {
  COLUMNS = 'COLUMNS',
  ROWS = 'ROWS',
}

export enum GoogleSheetName {
  iamweb = 'iamweb',
  log = 'log',
}

export class GoogleUtils {
  _googleSheet: sheets_v4.Sheets = null;

  constructor() {
    this._googleSheet = this.__getGoogleSheet();
  }

  __getGoogleSheet(): sheets_v4.Sheets {
    if (this._googleSheet !== null) {
      return this._googleSheet;
    }

    const authorize = new google.auth.JWT(
      GOOGLE_CLIENT_EMAIL,
      null,
      GOOGLE_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/spreadsheets'],
    );

    // google spread sheet api 가져오기
    this._googleSheet = google.sheets({
      version: 'v4',
      auth: authorize,
    });

    return this._googleSheet;
  }

  __read(
    rangeStart: string,
    rangeEnd: string,
    sheetName: GoogleSheetName,
  ): Promise<any[][]> {
    return new Promise((res, rej) => {
      setTimeout(async () => {
        const context = await this._googleSheet.spreadsheets.values.get({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: `${sheetName}!${rangeStart}:${rangeEnd}`,
        });
        res(context.data.values);
      }, 3000);
    });
  }

  // 구글시트 읽기
  async readGoogleSheet(
    rangeStart: string,
    rangeEnd: string,
    sheetName: GoogleSheetName,
  ): Promise<any[][]> {
    const res = await this.__read(rangeStart, rangeEnd, sheetName);
    return res;
    // const context = await this._googleSheet.spreadsheets.values.get({
    //   spreadsheetId: GOOGLE_SHEET_ID,
    //   range: `${sheetName}!${rangeStart}:${rangeEnd}`,
    // });
    // return context.data.values;
  }

  // 구글시트 읽기
  async readGoogleSheetRightNow(
    rangeStart: string,
    rangeEnd: string,
    sheetName: GoogleSheetName,
  ): Promise<any[][]> {
    const context = await this._googleSheet.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${sheetName}!${rangeStart}:${rangeEnd}`,
    });
    return context.data.values;
  }

  /// 구글시트에 쓰기
  async updateGoogleSheet(
    rangeStart: string,
    rangeEnd: string,
    values: string[][],
    sheetName: GoogleSheetName,
    direction: GoogleSheetDirecftion = GoogleSheetDirecftion.ROWS,
  ) {
    setTimeout(async () => {
      await this._googleSheet.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        valueInputOption: 'USER_ENTERED',
        range: `${sheetName}!${rangeStart}:${rangeEnd}`,
        requestBody: {
          majorDimension: direction.toString(),
          range: `${sheetName}!${rangeStart}:${rangeEnd}`,
          values: values,
        },
      });
    }, 1000);
  }
}
