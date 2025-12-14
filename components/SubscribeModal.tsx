import React, { useState, useEffect } from 'react';
import emailjs from '@emailjs/browser';
import { CalculationResult, IndicatorState } from '../types';

interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLink: string;
  // New props to generate report immediately
  currentResults: CalculationResult;
  currentPrice: number | null;
  currentDate: string;
  inputs: IndicatorState;
}

export const SubscribeModal: React.FC<SubscribeModalProps> = ({ 
  isOpen, 
  onClose, 
  currentLink, 
  currentResults, 
  currentPrice,
  currentDate,
  inputs 
}) => {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- CONFIGURATION ---
  const SERVICE_ID = 'service_hsnlldd';
  const TEMPLATE_ID = 'template_67w5f0a';
  const PUBLIC_KEY = 'C8dqNYkVgpGpWX15R';

  // Initialize EmailJS
  useEffect(() => {
    try {
      emailjs.init(PUBLIC_KEY);
    } catch (e) {
      console.warn("EmailJS init failed", e);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('btc_monitor_subscription');
    if (saved === 'true') {
      setIsSubscribed(true);
      const savedEmail = localStorage.getItem('btc_monitor_email');
      if (savedEmail) setEmail(savedEmail);
    }
  }, []);

  const generateEmailBody = () => {
    const priceStr = currentPrice 
        ? `$${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` 
        : '資料讀取中';

    return `
【📅 ${currentDate} 市場快報】
💰 BTC 現價: ${priceStr}
📊 週期總分: ${currentResults.totalScore.toFixed(1)} / 100
🌊 市場狀態: ${currentResults.advice.title}
💡 操作建議: ${currentResults.advice.description}

--------------------------------
[詳細指標數據]
• MVRV Z-Score: ${inputs.mvrv} (貢獻: ${currentResults.breakdown.find(b => b.id === 'mvrv')?.weightedScore.toFixed(1)})
• AHR999 Index: ${inputs.ahr999} (貢獻: ${currentResults.breakdown.find(b => b.id === 'ahr999')?.weightedScore.toFixed(1)})
• 2年 MA 倍數: ${inputs.maMultiplier}% (貢獻: ${currentResults.breakdown.find(b => b.id === 'maMultiplier')?.weightedScore.toFixed(1)})
• USDT 市占率: ${inputs.usdtDom}% (貢獻: ${currentResults.breakdown.find(b => b.id === 'usdtDom')?.weightedScore.toFixed(1)})
• 資金費率: ${inputs.funding}% (貢獻: ${currentResults.breakdown.find(b => b.id === 'funding')?.weightedScore.toFixed(1)})
• 週線 RSI: ${inputs.rsi} (貢獻: ${currentResults.breakdown.find(b => b.id === 'rsi')?.weightedScore.toFixed(1)})
    `.trim();
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Generate immediate report string
      const messageBody = generateEmailBody();

      const result = await emailjs.send(
        SERVICE_ID,
        TEMPLATE_ID,
        {
          to_email: email,          
          email: email,             
          reply_to: email,          
          message: messageBody,     // Passing the full text report
          report_link: currentLink,
          subscription_date: new Date().toLocaleDateString()
        },
        PUBLIC_KEY
      );

      console.log('Email sent successfully:', result.text);

      localStorage.setItem('btc_monitor_subscription', 'true');
      localStorage.setItem('btc_monitor_email', email);
      setIsSubscribed(true);
      
      alert(`設定成功！\n\n1. 確認信已發送至 ${email}。\n2. 此設定僅儲存於本機瀏覽器，當您打開本網頁時，若錯過當日報告會自動補發。\n\n⚠️ 注意：若要讓伺服器「不開電腦也能自動寄信」，請聯絡管理員將您的 Email 加入 GitHub Secrets 名單。`);

    } catch (error: any) {
      console.error('Email send failed full error:', JSON.stringify(error, null, 2));
      let errorMessage = '發生未知錯誤';
      if (typeof error === 'string') errorMessage = error;
      else if (error instanceof Error) errorMessage = error.message;
      else if (error?.text) errorMessage = `API Error: ${error.text}`;
      
      alert(`發送失敗: ${errorMessage}\n請檢查 Key 或 EmailJS 設定。`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = () => {
    setIsLoading(true);
    setTimeout(() => {
      localStorage.removeItem('btc_monitor_subscription');
      localStorage.removeItem('btc_monitor_email');
      setIsSubscribed(false);
      setEmail('');
      setIsLoading(false);
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl transform transition-all scale-100">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">開啟瀏覽器通知 & 測試</h2>
          <p className="text-slate-400 text-sm mt-2">
            輸入 Email 以測試發送功能，並在您打開本網頁時自動檢查是否需補發報告。
          </p>
        </div>

        {isSubscribed ? (
          <div className="text-center space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <p className="text-green-400 font-bold flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                本機設定已儲存
              </p>
              <p className="text-slate-300 text-sm mt-2">
                接收信箱：<br/>
                <span className="text-orange-300 font-mono mt-1 block">{email || '使用者信箱'}</span>
              </p>
              <p className="text-xs text-slate-500 mt-2 border-t border-slate-700/50 pt-2 text-left">
                ℹ️ 說明：此設定僅儲存於此瀏覽器。若要更改 GitHub 每日自動發送名單，請前往 Repository Settings 修改 Secrets。
              </p>
            </div>
            
            <button
              onClick={handleUnsubscribe}
              disabled={isLoading}
              className="text-slate-500 hover:text-red-400 text-sm underline transition-colors"
            >
              {isLoading ? '處理中...' : '移除本機設定'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                設定接收 Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                placeholder="name@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3.5 rounded-xl font-bold text-white transition-all transform active:scale-95 shadow-lg ${
                isLoading 
                  ? 'bg-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 shadow-orange-500/25'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  發送測試信...
                </span>
              ) : '發送測試信並儲存設定'}
            </button>
            
            <div className="text-xs text-left text-slate-500 mt-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
              <span className="text-orange-400 font-bold">重要提示：</span>
              <span className="text-slate-400 block mt-1">此按鈕不會更改伺服器的自動發信名單。它僅用於：</span>
              <ul className="list-disc list-inside mt-1 text-slate-500 pl-1">
                <li>發送一封即時測試信。</li>
                <li>當您打開此網頁時，瀏覽器會自動檢查並補發缺漏的報告。</li>
              </ul>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
