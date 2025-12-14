import { useRef } from 'react';

const PrintReceipt = ({ receipt, onClose }) => {
    const printRef = useRef(null);

    const handlePrint = () => {
        const printContent = printRef.current;
        const printWindow = window.open('', '_blank', 'width=350,height=700');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Receipt - ${receipt.receiptNo}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700&display=swap');
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                            font-family: 'Roboto Mono', 'Courier New', monospace;
                        }
                        body {
                            width: 80mm;
                            padding: 15px;
                            font-size: 12px;
                            background: #fff;
                        }
                        .receipt {
                            text-align: center;
                        }
                        .header {
                            padding-bottom: 15px;
                            margin-bottom: 15px;
                            border-bottom: 2px dashed #333;
                        }
                        .logo-text {
                            font-size: 24px;
                            font-weight: 700;
                            letter-spacing: 2px;
                            color: #1a1a1a;
                            margin-bottom: 5px;
                        }
                        .shop-tagline {
                            font-size: 11px;
                            color: #666;
                            letter-spacing: 1px;
                        }
                        .info {
                            text-align: left;
                            margin: 15px 0;
                            padding: 10px;
                            background: #f8f8f8;
                            border-radius: 5px;
                        }
                        .info-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 4px 0;
                            font-size: 11px;
                        }
                        .info-label {
                            color: #666;
                        }
                        .info-value {
                            font-weight: 500;
                            color: #333;
                        }
                        .items-header {
                            display: flex;
                            justify-content: space-between;
                            padding: 8px 0;
                            font-weight: 700;
                            font-size: 11px;
                            border-bottom: 1px solid #ddd;
                            margin-bottom: 8px;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }
                        .items {
                            border-top: 2px solid #333;
                            border-bottom: 2px solid #333;
                            padding: 10px 0;
                            margin: 10px 0;
                        }
                        .item {
                            display: flex;
                            justify-content: space-between;
                            padding: 6px 0;
                            font-size: 11px;
                            border-bottom: 1px dotted #ddd;
                        }
                        .item:last-child {
                            border-bottom: none;
                        }
                        .item-name {
                            text-align: left;
                            flex: 1;
                            font-weight: 500;
                        }
                        .item-qty {
                            width: 40px;
                            text-align: center;
                            color: #666;
                        }
                        .item-price {
                            width: 70px;
                            text-align: right;
                            font-weight: 500;
                        }
                        .total-section {
                            margin: 15px 0;
                            padding: 15px;
                            background: #f0f0f0;
                            border-radius: 5px;
                        }
                        .subtotal-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 5px 0;
                            font-size: 12px;
                        }
                        .discount-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 5px 0;
                            font-size: 12px;
                            color: #dc2626;
                            font-weight: 500;
                        }
                        .total-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 10px 0 5px;
                            margin-top: 8px;
                            border-top: 2px solid #333;
                            font-size: 16px;
                            font-weight: 700;
                        }
                        .footer {
                            margin-top: 20px;
                            text-align: center;
                            padding-top: 15px;
                            border-top: 2px dashed #333;
                        }
                        .thank-you {
                            font-size: 16px;
                            font-weight: 700;
                            margin-bottom: 5px;
                            letter-spacing: 1px;
                        }
                        .come-again {
                            font-size: 11px;
                            color: #666;
                            margin-bottom: 15px;
                        }
                        .barcode {
                            font-size: 8px;
                            letter-spacing: 3px;
                            padding: 10px;
                            background: #f5f5f5;
                            border-radius: 3px;
                            margin: 10px auto;
                            max-width: 200px;
                        }
                        .powered-by {
                            margin-top: 15px;
                            font-size: 9px;
                            color: #999;
                            letter-spacing: 1px;
                        }
                        @media print {
                            body { width: 80mm; margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    ${printContent.innerHTML}
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 300);
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const generateReceiptNo = () => {
        return `RCP-${Date.now().toString(36).toUpperCase()}`;
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl transform transition-all">
                {/* Preview Header */}
                <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-5 text-center">
                    <h3 className="text-xl font-bold mb-1">🧾 Receipt Preview</h3>
                    <p className="text-xs text-purple-200">Click Print to send to thermal printer</p>
                </div>

                {/* Receipt Content (for printing) */}
                <div ref={printRef} className="p-6 bg-white text-black max-h-96 overflow-y-auto">
                    <div className="receipt">
                        {/* Header */}
                        <div className="header">
                            <div className="logo-text">{receipt.shopName || 'AL HADI VAPES'}</div>
                            <div className="shop-tagline">✦ Your Premium Vape Store ✦</div>
                        </div>

                        {/* Info */}
                        <div className="info">
                            <div className="info-row">
                                <span className="info-label">📅 Date:</span>
                                <span className="info-value">{formatDate(receipt.date)}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">⏰ Time:</span>
                                <span className="info-value">{formatTime(receipt.date)}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">🔢 Receipt:</span>
                                <span className="info-value">{receipt.receiptNo || generateReceiptNo()}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">👤 Cashier:</span>
                                <span className="info-value">{receipt.cashier || 'Staff'}</span>
                            </div>
                        </div>

                        {/* Items */}
                        <div className="items">
                            <div className="items-header">
                                <span style={{ flex: 1, textAlign: 'left' }}>Item</span>
                                <span style={{ width: '40px', textAlign: 'center' }}>Qty</span>
                                <span style={{ width: '70px', textAlign: 'right' }}>Amount</span>
                            </div>
                            {receipt.items.map((item, index) => (
                                <div key={index} className="item">
                                    <span className="item-name">{item.name}</span>
                                    <span className="item-qty">×{item.qty}</span>
                                    <span className="item-price">Rs {(item.price * item.qty).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>

                        {/* Total Section */}
                        <div className="total-section">
                            <div className="subtotal-row">
                                <span>Subtotal:</span>
                                <span>Rs {receipt.subtotal.toFixed(2)}</span>
                            </div>
                            {receipt.discount && (
                                <div className="discount-row">
                                    <span>Discount ({receipt.discount.percent}%):</span>
                                    <span>-Rs {receipt.discount.amount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="total-row">
                                <span>TOTAL:</span>
                                <span>Rs {receipt.total.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="footer">
                            <div className="thank-you">★ THANK YOU! ★</div>
                            <div className="come-again">We appreciate your business</div>
                            <div className="barcode">
                                ▌▐▌ {receipt.receiptNo || generateReceiptNo()} ▌▐▌
                            </div>
                            <div className="powered-by">
                                Powered by Al Hadi Vapes POS
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="p-4 bg-gray-50 flex gap-3 border-t">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-gray-500 text-white rounded-xl font-semibold hover:bg-gray-600 transition-all shadow-md"
                    >
                        ✕ Close
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-md flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print Receipt
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrintReceipt;
