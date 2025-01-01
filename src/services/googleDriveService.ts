// src/services/googleDriveService.ts

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// サービスアカウントのJSONファイルパスを指定
const KEY_FILE_PATH = path.join(__dirname, '../../credentials/credentials.json');

// 認証スコープ (読み書き権限)
const SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Google Drive API で使う認証クライアントを生成
 */
function createAuthClient() {
  // 認証情報のJSONを読み込む
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: SCOPES
  });
  return auth;
}

/**
 * ファイル名からファイルIDを検索して、最初に見つかったファイルの ID を返す
 */
export async function findFileIdByName(fileName: string): Promise<string | null> {
  const authClient = createAuthClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  const res = await drive.files.list({
    q: `name='${fileName}'`,
    fields: 'files(id, name)'
  });
  const files = res.data.files;
  if (files && files.length > 0 && files[0].id) {
    return files[0].id;
  }
  return null;
}

/**
 * 指定した fileId のファイルをダウンロードしてローカルに保存
 */
export async function downloadFile(fileId: string, destPath: string): Promise<void> {
  const authClient = createAuthClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  fs.writeFileSync(destPath, Buffer.from(response.data as ArrayBuffer));
}

/**
 * ローカルファイルを Google Drive にアップロード
 * - 存在するファイルを更新したい場合は `existingFileId` を渡す
 */
export async function uploadFile(
  fileName: string,
  localPath: string,
  existingFileId?: string
): Promise<string> {
  const authClient = createAuthClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  if (existingFileId) {
    // 既存ファイルを更新
    await drive.files.update({
      fileId: existingFileId,
      media: {
        body: fs.createReadStream(localPath),
      },
    });
    return existingFileId;
  } else {
    // 新規にアップロード
    const fileMetadata = {
      name: fileName
    };
    const media = {
      body: fs.createReadStream(localPath),
    };
    const res = await drive.files.create({
      requestBody: fileMetadata,
      media: media
    });
    return res.data.id || '';
  }
}
