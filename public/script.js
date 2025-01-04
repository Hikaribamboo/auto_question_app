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
    const file = data.docs[0];
    document.getElementById("file-info").innerText = `Selected file: ${file.name} (${file.id})`;
    console.log(`File ID: ${file.id}, File Name: ${file.name}`);
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

// GIS クライアントのロードを保証
window.onload = initializeApp;
