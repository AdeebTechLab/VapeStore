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
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                            font-family: 'Segoe UI', Arial, sans-serif;
                        }
                        body {
                            width: 80mm;
                            padding: 12px;
                            font-size: 12px;
                            background: #fff;
                        }
                        .receipt {
                            text-align: center;
                        }
                        .header {
                            padding-bottom: 12px;
                            margin-bottom: 12px;
                            border-bottom: 2px dashed #333;
                        }
                        .shop-name {
                            font-size: 20px;
                            font-weight: 700;
                            color: #1a1a1a;
                            margin-bottom: 4px;
                        }
                        .tagline {
                            font-size: 10px;
                            color: #666;
                        }
                        .info {
                            text-align: left;
                            margin: 10px 0;
                            font-size: 11px;
                        }
                        .info-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 3px 0;
                        }
                        .items {
                            border-top: 1px solid #333;
                            border-bottom: 1px solid #333;
                            padding: 10px 0;
                            margin: 10px 0;
                        }
                        .item {
                            display: flex;
                            justify-content: space-between;
                            padding: 5px 0;
                            font-size: 11px;
                        }
                        .item-name {
                            flex: 1;
                            text-align: left;
                            font-weight: 500;
                        }
                        .item-qty {
                            width: 35px;
                            text-align: center;
                            color: #666;
                        }
                        .item-price {
                            width: 70px;
                            text-align: right;
                            font-weight: 600;
                        }
                        .total-section {
                            text-align: right;
                            padding: 10px 0;
                        }
                        .subtotal {
                            font-size: 11px;
                            margin-bottom: 5px;
                        }
                        .discount {
                            font-size: 11px;
                            color: #dc2626;
                            margin-bottom: 5px;
                        }
                        .grand-total {
                            font-size: 16px;
                            font-weight: 700;
                            padding-top: 8px;
                            border-top: 2px solid #333;
                        }
                        .payment-method {
                            margin-top: 8px;
                            font-size: 11px;
                            color: #444;
                        }
                        .footer {
                            margin-top: 15px;
                            text-align: center;
                            padding-top: 10px;
                            border-top: 2px dashed #333;
                            font-size: 11px;
                        }
                        .thank-you {
                            font-weight: 700;
                            margin-bottom: 5px;
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
        return new Date(date).toLocaleDateString('en-PK', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString('en-PK', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl">
                {/* Preview Header */}
                <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 text-center">
                    <h3 className="text-lg font-bold">🧾 Receipt Preview</h3>
                    <p className="text-xs text-green-100">Ready to print</p>
                </div>

                {/* Receipt Content */}
                <div ref={printRef} className="p-5 bg-white text-black max-h-80 overflow-y-auto">
                    <div className="receipt">
                        {/* Header */}
                        <div className="header">
                            <div className="shop-name">Al Hadi Vapes</div>
                            <div className="tagline">Your Premium Vape Store</div>
                        </div>

                        {/* Info */}
                        <div className="info">
                            <div className="info-row">
                                <span>Date:</span>
                                <span>{formatDate(receipt.date)} {formatTime(receipt.date)}</span>
                            </div>
                            <div className="info-row">
                                <span>Receipt #:</span>
                                <span>{receipt.receiptNo}</span>
                            </div>
                            <div className="info-row">
                                <span>Cashier:</span>
                                <span>{receipt.cashier || 'Staff'}</span>
                            </div>
                            {receipt.customer && receipt.customer.name && (
                                <div className="info-row" style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #ddd' }}>
                                    <span>Customer:</span>
                                    <span>{receipt.customer.name}</span>
                                </div>
                            )}
                            {receipt.customer && receipt.customer.phone && (
                                <div className="info-row">
                                    <span>Phone:</span>
                                    <span>{receipt.customer.phone}</span>
                                </div>
                            )}
                        </div>

                        {/* Items */}
                        <div className="items">
                            {receipt.items && receipt.items.length > 0 ? (
                                receipt.items.map((item, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            border: '1px solid #ddd',
                                            borderRadius: '6px',
                                            padding: '8px 10px',
                                            marginBottom: '8px',
                                            backgroundColor: item.hasDiscount ? '#f0fdf4' : '#fff'
                                        }}
                                    >
                                        {/* Product Name & Qty */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontWeight: 600, fontSize: '12px', color: '#1a1a1a' }}>
                                                {item.name || item.productName || 'Product'}
                                            </span>
                                            <span style={{
                                                backgroundColor: '#e5e7eb',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontSize: '10px',
                                                fontWeight: 600
                                            }}>
                                                ×{item.qty}
                                            </span>
                                        </div>

                                        {/* Price Details */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                                            <div>
                                                {item.hasDiscount ? (
                                                    <>
                                                        <span style={{ textDecoration: 'line-through', color: '#9ca3af', marginRight: '6px' }}>
                                                            Rs {item.originalPrice}
                                                        </span>
                                                        <span style={{ color: '#16a34a', fontWeight: 600 }}>
                                                            Rs {item.cartPrice}/each
                                                        </span>
                                                    </>
                                                ) : item.paidTotal && item.paidTotal < item.cartTotal ? (
                                                    <>
                                                        <span style={{ textDecoration: 'line-through', color: '#9ca3af', marginRight: '6px' }}>
                                                            Rs {item.cartPrice}/each
                                                        </span>
                                                        <span style={{ color: '#dc2626', fontWeight: 600 }}>
                                                            Rs {Math.round(item.paidTotal / item.qty)}/each
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span style={{ color: '#666' }}>
                                                        Rs {item.cartPrice}/each
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontWeight: 700, fontSize: '13px', color: item.paidTotal && item.paidTotal < item.cartTotal ? '#dc2626' : '#000' }}>
                                                Rs {(item.paidTotal || item.cartTotal)?.toFixed(0) || '0'}
                                            </div>
                                        </div>

                                        {/* Savings Badge */}
                                        {item.hasDiscount && item.savedAmount > 0 && (
                                            <div style={{
                                                marginTop: '4px',
                                                fontSize: '9px',
                                                color: '#16a34a',
                                                backgroundColor: '#dcfce7',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                display: 'inline-block'
                                            }}>
                                                💰 Saved: Rs {item.savedAmount.toFixed(0)}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p style={{ textAlign: 'center', color: '#999', padding: '10px 0' }}>No items</p>
                            )}
                        </div>

                        {/* Total Section */}
                        <div className="total-section">
                            <div className="subtotal">
                                Subtotal: Rs {receipt.subtotal?.toFixed(0) || '0'}
                            </div>
                            {receipt.discount && (
                                <div className="discount">
                                    Discount: -Rs {receipt.discount.amount?.toFixed(0) || '0'}
                                </div>
                            )}
                            <div className="grand-total">
                                TOTAL: Rs {receipt.total?.toFixed(0) || '0'}
                            </div>
                            {receipt.paymentMethod && (
                                <div className="payment-method">
                                    Payment: {receipt.paymentMethod}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="footer">
                            <div className="thank-you">Thank You!</div>
                            <div>We appreciate your business</div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="p-4 bg-gray-50 flex gap-3 border-t">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-gray-500 text-white rounded-xl font-semibold hover:bg-gray-600 transition-all"
                    >
                        Close
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrintReceipt;
