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
          }
          ,
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
}

document.addEventListener("DOMContentLoaded", () => {
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
})
    
  
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

// 作問開始ボタンが押されたときのイベント
startButton.addEventListener("click", async () => {
    const selectedSubject = subjectSelect.value;
    const selectedFormat = formatSelect.value;
    const selectedCount = questionCount.value;
  
    if (!selectedSubject || !selectedFormat || !selectedCount || selectedFileIds.length === 0) {
      alert("全てのフィールドを入力し、ファイルを選択してください！");
      return;
    }
  
    // フォームデータを作成
    const formData = new FormData();
    formData.append("subject", selectedSubject);
    formData.append("format", selectedFormat);
    formData.append("numQuestions", selectedCount);
    selectedFileIds.forEach((fileId) => {
      formData.append("files", fileId); // 選択したファイルIDを追加
    });
  
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
  });
  
  
// 問題作成のアルゴリズム実装例

async function processFiles({ subject, format, numQuestions, fileIds }) {
    const QUESTIONS_PER_BATCH = format === "四択" && subject === "英語" ? 10 : 5;
    const totalBatches = Math.ceil(numQuestions / QUESTIONS_PER_BATCH);
    const results = [];
  
    console.log("Starting to process files:", { subject, format, numQuestions, fileIds });
  
    // ファイル内容を取得
    const fileContents = await Promise.all(
      fileIds.map(async (fileId) => {
        const response = await fetch(`/get-file-content/${fileId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch content for file ${fileId}`);
        }
        return await response.text();
      })
    );
  
    console.log("取得したファイル内容:", fileContents);
  
    // 命令文を生成してChatGPTに送信
    for (let i = 0; i < totalBatches; i++) {
      let command = `Please create ${QUESTIONS_PER_BATCH} ${subject} questions in the format: ${format}.\n`;
      command += `Based on the following file contents:\n${fileContents.join("\n\n")}\n`;
  
      if (format === "四択") {
        command += `
          Name the columns question, answer, a, b, and c.
          Don't reuse the same words too much, and make b, c, and d words that can't be answers.
          Also, don't use words that are too simple.
        `;
      }
  
      if (subject === "英語" && format === "語彙") {
        command = `
          Please create ${QUESTIONS_PER_BATCH} English vocabulary questions based on the following list of words:
          ${fileContents.join("\n")}
          Name the columns question, answer, a, b, and c.
          Don't reuse the same words too much, and make b, c, and d words that can't be answers.
        `;
      } else if (subject === "英語" && format === "文法") {
        command = `
          Please create ${QUESTIONS_PER_BATCH} English grammar questions based on the following file contents:
          ${fileContents.join("\n\n")}
          Name the columns question, answer, a, b, and c.
          Don't reuse the same content too much, and make b, c, and d options incorrect.
        `;
      }
  
      console.log("Generated command:", command);
  
      // ChatGPTに命令文を送信
      const response = await sendCommandToChatGPT(command);
      results.push(response);
    }
  
    return results.flat();
  }
  
  async function sendCommandToChatGPT(command) {
    try {
      const response = await fetch("/chat-with-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
  
      const data = await response.json();
      if (data.success) {
        console.log("ChatGPT Response:", data.results);
        return data.results;
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error("Failed to send command to ChatGPT:", error);
      throw error;
    }
  }
  
// GIS クライアントのロードを保証
window.onload = initializeApp;
