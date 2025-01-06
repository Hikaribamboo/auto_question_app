import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// 認証用のクレデンシャル情報とスコープ
const KEY_FILE_PATH = path.join(__dirname, '../../credentials/credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// Google OAuth2 クライアントを作成する
function createAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: SCOPES,
  });
  return auth;
}

// ** 1. Google Drive Pickerでファイルを選択 **
export function initGooglePicker(clientId: string, developerKey: string): string {
  return `
    <script type="text/javascript">
      function onApiLoad() {
        gapi.load('picker', { callback: onPickerApiLoad });
      }
      function onPickerApiLoad() {
        const picker = new google.picker.PickerBuilder()
          .setOAuthToken(gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token)
          .setDeveloperKey('${developerKey}')
          .setCallback(pickerCallback)
          .build();
        picker.setVisible(true);
      }
      function pickerCallback(data) {
        if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
          const file = data[google.picker.Response.DOCUMENTS][0];
          console.log('Selected file:', file);
          alert('Selected file: ' + JSON.stringify(file)); // ファイル情報を確認
        }
      }
    </script>
  `;
}

// ** 2. Google Driveファイルの内容を更新 **
export async function updateFileContent(fileId: string, newContent: string): Promise<void> {
  const authClient = createAuthClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  // 一時的に新しい内容をローカルに保存
  const tempFilePath = path.join(__dirname, '../../temp/tempfile.txt');
  fs.writeFileSync(tempFilePath, newContent);

  // Google Drive APIを使用してファイルを更新
  await drive.files.update({
    fileId,
    media: {
      body: fs.createReadStream(tempFilePath),
    },
  });

  // 一時ファイルを削除
  fs.unlinkSync(tempFilePath);
}

// ** 3. Google Driveのファイル一覧を取得 **
export async function listFiles(authToken: string): Promise<any[]> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: authToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const response = await drive.files.list({
    pageSize: 10, // 取得するファイル数
    fields: 'files(id, name)', // 必要に応じて取得フィールドを変更
  });

  return response.data.files || [];
}
