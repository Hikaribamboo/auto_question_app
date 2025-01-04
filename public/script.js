let tokenClient;
let oauthToken;

// GIS クライアントの初期化
function initializeGisClient(clientId) {
  console.log("Starting GIS Client Initialization...");

  if (!google || !google.accounts || !google.accounts.oauth2) {
    console.error("GIS Client library is not properly loaded.");
    return;
  }

  console.log("All required Google libraries are loaded. Proceeding to initTokenClient...");

  document.getElementById("pick-file").style.display = "block";
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
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
let selectedFileIds = []; // 選択されたファイルIDを一時保存

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

// 初期化処理
async function initializeApp() {
  try {
    const response = await fetch("/env");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const { clientId } = await response.json();
    if (!clientId) {
      throw new Error("Client ID is missing.");
    }

    console.log("Environment variables loaded. Initializing GIS client...");
    initializeGisClient(clientId);

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

  startAction()
  
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
  
});

// バイナリデータを取得して送信
async function fetchAndSendFiles(subject, format, numQuestions) {
    const formData = new FormData();
  
    for (const file of selectedFiles) {
      const fileContent = await fetchFileContent(file.id);
      formData.append("files", new Blob([fileContent]), file.name);
    }
  
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
        console.log("作問結果:", result.results);
        alert("作問が完了しました！");
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("作問処理中にエラーが発生しました:", error);
      alert("作問処理に失敗しました。");
    }
  }
  
  // Google Drive API を使用してファイルのバイナリデータを取得
  async function fetchFileContent(fileId) {
    const response = await gapi.client.request({
      path: `/drive/v3/files/${fileId}`,
      method: "GET",
      params: { alt: "media" },
      headers: { Authorization: `Bearer ${oauthToken}` },
    });
  
    return response.body;
  }

async function startAction() {
    const startButton = document.getElementById("start-creation");
    // 作問開始ボタンが押されたときのイベント
    startButton.addEventListener("click", async () => {
    const selectedSubject = subjectSelect.value;
    const selectedFormat = formatSelect.value;
    const selectedCount = questionCount.value;
  
    if (!selectedSubject || !selectedFormat || !selectedCount || selectedFiles.length === 0) {
      alert("全てのフィールドを入力し、ファイルを選択してください！");
      return;
    }
  
    await fetchAndSendFiles(selectedSubject, selectedFormat, selectedCount);
  });
}

// GIS クライアントのロードを保証
window.onload = initializeApp;

