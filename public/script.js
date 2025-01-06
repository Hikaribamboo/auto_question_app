let tokenClient;
let oauthToken;
let selectedFileIds = []; // 選択されたファイルIDを一時保存
let apiKey; // APIキー
let clientId; // クライアントID

// 初期化処理
async function initializeApp() {
  try {
    console.log("[initializeApp] Fetching environment variables...");
    const response = await fetch("/env");

    if (!response.ok) {
      throw new Error(`[initializeApp] HTTP error! Status: ${response.status}`);
    }

    const env = await response.json();
    clientId = env.clientId;
    apiKey = env.apiKey;

    if (!apiKey) {
      throw new Error("[initializeApp] Client ID or API Key is missing.");
    }

    console.log("[initializeApp] Environment variables loaded:", { clientId, apiKey });
    initializeGisClient(); // GIS クライアントを初期化

    // ボタンのクリックで Picker を表示
    const pickFileButton = document.getElementById("pick-file");
    console.log("Setting up 'Pick File' button event listener...");
    pickFileButton.addEventListener("click", () => {
      console.log("Pick File button clicked.");
      tokenClient.requestAccessToken();
      console.log("Access token requested");
    });
  } catch (error) {
    console.error("Failed to initialize application:", error);
    showError("アプリケーションの初期化に失敗しました。");
  }

}

// GIS クライアントの初期化
function initializeGisClient() {
  console.log("Starting GIS Client Initialization...");

  if (!google || !google.accounts || !google.accounts.oauth2) {
    console.error("GIS Client library is not properly loaded.");
    return;
  }

  console.log("All required Google libraries are loaded. Proceeding to initTokenClient...");

  document.getElementById("pick-file").style.display = "block";
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId, // 事前に取得したクライアントIDを使用
      scope: "https://www.googleapis.com/auth/drive",
      callback: (response) => {
        console.log("Callback invoked with response:", response);
        if (response.access_token) {
          oauthToken = response.access_token;
          console.log("OAuth Token obtained:", oauthToken);
          createPicker();
        } else {
          console.error("Failed to obtain access token.");
          showError("トークンの取得に失敗しました。もう一度お試しください。");
        }
      },
    });
    console.log("Token Client initialized successfully.");
  } catch (error) {
    console.error("Error initializing Token Client:", error);
  }
}

// Google Picker の作成
async function createPicker() {
  try {
    const response = await fetch("/env");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const { apiKey } = await response.json();

    if (!oauthToken) {
      console.error("OAuth Token is not available.");
      return;
    }

    gapi.load("picker", () => {
      const picker = new google.picker.PickerBuilder()
        .addView(google.picker.ViewId.DOCS)
        .setOAuthToken(oauthToken)
        .setDeveloperKey(apiKey)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED) // 複数選択を有効化
        .setCallback(pickerCallback)
        .build();
      picker.setVisible(true);
    });
  } catch (error) {
    console.error("Failed to load API Key or initialize Picker:", error);
    showError("Picker の初期化に失敗しました。");
  }
}

// Picker のコールバック

function pickerCallback(data) {
  if (data.action === google.picker.Action.PICKED) {
    selectedFileIds = data.docs.map((file) => file.id); // ファイルIDを保存
    console.log("Selected file IDs:", selectedFileIds);

    // 選択ファイルを画面に表示
    const fileDisplay = document.getElementById("file-display");
    fileDisplay.innerHTML = ""; // 既存の表示をクリア
    data.docs.forEach((file) => {
      const li = document.createElement("li");
      li.textContent = `Name: ${file.name}, ID: ${file.id}`;
      fileDisplay.appendChild(li);
    });
  } else if (data.action === google.picker.Action.CANCEL) {
    console.log("Picker was cancelled.");
  }
}

// エラーを表示する関数
function showError(message) {
  const errorDiv = document.getElementById("file-info");
  errorDiv.innerText = message;
  errorDiv.style.color = "red";
}

// DOM ロード完了時に実行
document.addEventListener("DOMContentLoaded", () => {
  // ここでID取得＆イベント設定する
  const subjectSelect = document.getElementById("subject-select");
  const formatSelect = document.getElementById("format-select");
  const formatLabel = document.getElementById("format-label");
  const questionCount = document.getElementById("question-count");
  const countLabel = document.getElementById("count-label");
  const startButton = document.getElementById("start-creation");

  // 科目ごとの出題形式
  const formatOptions = {
    国語: ["現代文", "古文", "漢文"],
    数学: ["入力", "四択"],
    英語: ["四択（文法）", "四択（語彙）", "長文"],
  };

  // 科目選択時のイベント
  subjectSelect.addEventListener("change", () => {
    const selectedSubject = subjectSelect.value;
    console.log("選択された科目:", selectedSubject);

    if (selectedSubject) {
      // 出題形式プルダウンを更新
      updateFormatOptions(selectedSubject);
      formatLabel.style.display = "inline";
      formatSelect.style.display = "inline";
      countLabel.style.display = "inline";
      questionCount.style.display = "inline";
      startButton.style.display = "inline";
    } else {
      formatLabel.style.display = "none";
      formatSelect.style.display = "none";
      countLabel.style.display = "none";
      questionCount.style.display = "none";
      startButton.style.display = "none";
    }
  });

    // 出題形式プルダウンを更新する関数
    function updateFormatOptions(subject) {
        // プルダウンを初期化
        formatSelect.innerHTML = '<option value="" disabled selected>-- 出題形式を選択 --</option>';

        // 対応する出題形式を追加
        formatOptions[subject].forEach((format) => {
            const option = document.createElement("option");
            option.value = format;
            option.textContent = format;
            formatSelect.appendChild(option);
        });
    }

    // 「作問開始」ボタンが押されたとき
  startButton.addEventListener("click", async () => {
    // pickしたファイルIDが入った selectedFileIds を使って処理
    if (selectedFileIds.length === 0) {
      alert("ファイルを選択していません！");
      return;
    }
    const selectedSubject = subjectSelect.value;
    const selectedFormat = formatSelect.value;
    const selectedCount = questionCount.value;
    await fetchAndSendFiles(selectedSubject, selectedFormat, selectedCount);
  });
  
});

// バイナリデータを取得して送信
async function fetchAndSendFiles(subject, format, numQuestions) {
    const formData = new FormData();

    for (const fileId of selectedFileIds) {
      const blob = await fetchFileAsBlob(fileId);
      formData.append("file", blob, `${fileId}.png`); // サーバーに送信するファイル名を指定
      // （拡張子やファイル名は適当につける）
    }
    console.log(formData)
    formData.append("subject", subject);
    formData.append("format", format);
    formData.append("numQuestions", numQuestions);

    try {
      const response = await fetch("/chat-with-files", {
        method: "POST",
        body: formData,
      });
  
      const result = await response.json();
      if (result.success) {
        console.log("作問結果:", result.tableData);
        displayTableOutput(result.tableData); // テーブル形式で表示
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("作問処理中にエラーが発生しました:", error);
      alert("作問処理に失敗しました。");
    }
  }
  
// 1. Google Drive API を使用してファイルのバイナリデータを取得する関数
async function fetchFileAsBlob(fileId) {
  console.log(`[fetchFileAsBlob] Start fetching file: ${fileId}`);
  console.log("This is token:", oauthToken);

  try {
    // 1. ファイルの形式を取得
    const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name&key=${apiKey}`; // nameも取得
    const metadataRes = await fetch(metadataUrl, {
      headers: { Authorization: `Bearer ${oauthToken}` },
    });

    if (!metadataRes.ok) {
      const errorDetails = await metadataRes.json();
      throw new Error(`Failed to fetch file metadata: ${errorDetails.error.message}`);
    }

    const metadata = await metadataRes.json();
    const mimeType = metadata.mimeType;
    const fileName = metadata.name;

    console.log(`[fetchFileAsBlob] File MIME type: ${mimeType}`);
    console.log(`[fetchFileAsBlob] File name: ${fileName}`);

    // PNGファイルの判別
    if (mimeType === "image/png") {
      console.log(`[fetchFileAsBlob] The file is a PNG image.`);
    } else {
      console.log(`[fetchFileAsBlob] The file is not a PNG image.`);
    }

    let url;

    // 2. Google Docs形式ならExport APIを利用
    if (mimeType.startsWith("application/vnd.google-apps.")) {
      // Google Docs, Spreadsheets, Slides の場合
      const exportMimeType =
        mimeType === "application/vnd.google-apps.spreadsheet"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" // Excel形式
          : "application/pdf"; // その他はPDF形式でエクスポート

      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${exportMimeType}`;
    } else {
      // バイナリファイルの場合
      url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    // 3. ファイルを取得
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${oauthToken}` },
    });

    console.log(`[fetchFileAsBlob] fetch response status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorDetails = await res.json();
      throw new Error(`Failed to fetch file data: ${errorDetails.error.message}`);
    }

    const blob = await res.blob();
    console.log(`[fetchFileAsBlob] Successfully fetched file: ${fileId}`);
    return blob;
  } catch (err) {
    console.error(`[fetchFileAsBlob] Error occurred while fetching file: ${fileId}`, err);
    throw err;
  }
}

// GIS クライアントのロードを保証
window.onload = initializeApp;

// テーブル形式でHTMLに表示
function displayTableOutput(tableData) {
  const outputSection = document.getElementById("output-section"); // HTMLの表示場所
  outputSection.innerHTML = ""; // 既存の内容をクリア

  // テーブル要素を作成
  const table = document.createElement("table");
  table.border = "1"; // 枠線を付ける
  table.style.borderCollapse = "collapse"; // 枠線を結合
  table.style.width = "100%";

  // テーブルヘッダーを作成
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = ["Question", "Answer", "A", "B", "C"]; // 列名
  headers.forEach((headerText) => {
    const th = document.createElement("th");
    th.style.padding = "8px";
    th.style.textAlign = "left";
    th.style.backgroundColor = "#f2f2f2";
    th.textContent = headerText;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // テーブルボディを作成
  const tbody = document.createElement("tbody");
  tableData.forEach((row) => {
    const tr = document.createElement("tr");

    // 各行のセルを追加
    ["question", "answer", "a", "b", "c"].forEach((key) => {
      const td = document.createElement("td");
      td.style.padding = "8px";
      td.style.border = "1px solid #ddd";
      td.textContent = row[key];
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  // テーブルを出力セクションに追加
  outputSection.appendChild(table);
}
