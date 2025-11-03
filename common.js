/**
 * common.js: 送受信システム間で共有される設定やプロトコルを定義する。
 */

// QRコードに関する設定
const QR_PAYLOAD_SIZE = 1500; // 1つのQRコードに含まれるペイロードの最大バイト数
const QR_TRANSMISSION_INTERVAL = 500; // QRコードを切り替える基本時間間隔(ミリ秒)

const QR_CONFIG = {
    errorCorrectionLevel: 'M', // 誤り訂正レベル
    typeNumber: 40, // QRコードのバージョン (40が最大)
};

// WebSocketに関する設定
const WEBSOCKET_URL = `ws://${window.location.hostname}:8080`;

/**
 * メタデータオブジェクトの構造定義 (コメントとして)
 * 転送する最初のQRコードには、以下の情報を含むJSONを含める。
 * {
 *   type: 'metadata',
 *   payload: {
 *     fileName: String,
 *     fileSize: Number,
 *     fileType: String,
 *     totalChunks: Number
 *   }
 * }
 */
