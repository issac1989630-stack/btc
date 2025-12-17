import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import emailjs from '@emailjs/browser';
import { IndicatorState, CalculationResult } from './types';
import { InputSlider } from './components/InputSlider';
import { ScoreGauge } from './components/ScoreGauge';
import { BreakdownChart } from './components/BreakdownChart';
import { SubscribeModal } from './components/SubscribeModal';

const App: React.FC = () => {
  // 1. Initialize State
  const [currentDate, setCurrentDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [priceTrend, setPriceTrend] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [dataSourceInfo, setDataSourceInfo] = useState<string>("尚未同步");
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState<boolean>(false);
  
  // Auto-send status tracking
  const [autoSendStatus, setAutoSendStatus] = useState<string>("等待排程檢查...");
  const [lastAutoSentDate, setLastAutoSentDate] = useState<string>("");

  // Ref to store price history for 1-minute trend comparison
  const priceHistoryRef = useRef<{ price: number, timestamp: number }[]>([]);
  
  const [inputs, setInputs] = useState<IndicatorState>({
    mvrv: 1.5,           // Range -1 to 7
    ahr999: 1.2,         // Range 0.45 to 10
    maMultiplier: 40,    // Range 0 to 100 (%)
    usdtDom: 5.0,        // Range 2 to 8 (%)
    funding: 0.01,       // Range 0 to 0.1 (%)
    rsi: 50              // Range 30 to 90
  });

  // --- EMAIL CONFIG ---
  const EMAIL_SERVICE_ID = 'service_hsnlldd';
  const EMAIL_TEMPLATE_ID = 'template_67w5f0a';
  const EMAIL_PUBLIC_KEY = 'C8dqNYkVgpGpWX15R';

  // --- MATH HELPERS ---
  const calculateSMA = (data: number[], window: number) => {
    if (data.length < window) return null;
    const slice = data.slice(data.length - window);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / window;
  };

  const calculateGeoMean = (data: number[], window: number) => {
    if (data.length < window) return null;
    const slice = data.slice(data.length - window);
    const sumLog = slice.reduce((acc, val) => acc + Math.log(val), 0);
    return Math.exp(sumLog / window);
  };

  const calculateRSI = (prices: number[], period: number = 14) => {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
        }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  // --- SPECIFIC DATA FETCHERS ---
  const fetchFundingRate = async (): Promise<{value: number, source: string}> => {
    try {
      const res = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT', { 
credentials: 'omit',
              signal: AbortSignal.timeout(3000) 
      });
      if (!res.ok) throw new Error("Binance Blocked");
      const data = await res.json();
      return { value: parseFloat(data.lastFundingRate) * 100, source: 'Binance' };
    } catch (e) {
      try {
        const res = await fetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT', { credentials: 'omit' });
        const data = await res.json();
        return { value: parseFloat(data.result.list[0].fundingRate) * 100, source: 'Bybit' };
      } catch (err) {
        return { value: 0.01, source: 'Default' };
      }
    }
  };

  const fetchMVRVZScore = async (prices: number[]): Promise<{value: number, source: string}> => {
    try {
      const res = await fetch('https://api.blockchain.info/charts/mvrv-z-score?timespan=5weeks&rollingAverage=8hours&format=json', { 
{
      credentials: 'omit',
              headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000)
    }
      });
      if (!res.ok) throw new Error("Blockchain.info Blocked");
      const data = await res.json();
      const lastVal = data.values[data.values.length - 1];
      return { value: lastVal.y, source: 'Blockchain.info' };
    } catch (e) {
      const currentPrice = prices[prices.length - 1];
      const ma200Week = calculateSMA(prices, 1400); 
      let proxy = 1.5;
      if (ma200Week) {
          const ratio = currentPrice / ma200Week;
          proxy = ((ratio - 0.8) / 3.2) * 8 - 1;
      }
      return { value: proxy, source: 'Calc(Price/200WMA)' };
    }
  };

  const fetchUSDTDom = async (): Promise<{value: number, source: string}> => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/global', { credentials: 'omit' });
      if (!res.ok) throw new Error("CG Global Failed");
      const data = await res.json();
      const val = data.data.market_cap_percentage.usdt;
      return { value: val, source: 'CoinGecko' };
    } catch (e) {
      return { value: 5.0, source: 'Default' };
    }
  };

  const updateLivePriceOnly = async () => {
    try {
        const response = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot', { credentials: 'omit' });
        if (!response.ok) return;
        const json = await response.json();
        const newPrice = parseFloat(json.data.amount);
        setBtcPrice(newPrice);
        updateTrend(newPrice);
    } catch (e) {
        // Silent fail
    }
  };

  const updateTrend = (newPrice: number) => {
      const now = Date.now();
      const history = priceHistoryRef.current;
      history.push({ price: newPrice, timestamp: now });
      const oneMinuteAgo = now - 60000;
      while(history.length > 0 && history[0].timestamp < oneMinuteAgo) {
          history.shift();
      }
      if (history.length > 0) {
        const startPrice = history[0].price;
        if (newPrice > startPrice) setPriceTrend('up');
        else if (newPrice < startPrice) setPriceTrend('down');
        else setPriceTrend('neutral');
      }
  };

  // --- FALLBACK FETCH ---
  const mapRange = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  };

  const fetchFallbackData = async () => {
      try {
        const fngResponse = await fetch('https://api.alternative.me/fng/', { credentials: 'omit' });
        let fngValue = 50; 
        if (fngResponse.ok) {
            const fngJson = await fngResponse.json();
            fngValue = parseInt(fngJson.data[0].value, 10);
        }

        const estimatedMvrv = mapRange(fngValue, 0, 100, -0.8, 4.5);
        const estimatedAhr = mapRange(fngValue, 0, 100, 0.5, 6.0);
        const estimatedMa = mapRange(fngValue, 0, 100, 10, 95);
        const estimatedUsdt = mapRange(fngValue, 0, 100, 7.5, 2.5);
        const estimatedFunding = mapRange(fngValue, 0, 100, -0.005, 0.06);
        const estimatedRsi = mapRange(fngValue, 0, 100, 32, 85);

        setInputs({
            mvrv: Number(estimatedMvrv.toFixed(2)),
            ahr999: Number(estimatedAhr.toFixed(2)),
            maMultiplier: Math.floor(estimatedMa),
            usdtDom: Number(estimatedUsdt.toFixed(2)),
            funding: Number(estimatedFunding.toFixed(4)),
            rsi: Math.floor(estimatedRsi)
        });

        setDataSourceInfo(`API 受限 - 智能估算模式 (F&G: ${fngValue})`);
        await updateLivePriceOnly();

      } catch (e) {
          setDataSourceInfo("數據完全無法同步");
      }
  };

  // --- MAIN ORCHESTRATOR (Memoized for use in Intervals) ---
  const fetchDataOrchestrator = useCallback(async () => {
    setIsLoading(true);
    setDataSourceInfo("正在從 API 獲取數據...");

    try {
      const historyRes = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=max&interval=daily', { credentials: 'omit' });
      if (!historyRes.ok) throw new Error("CoinGecko History API Failed");
      
      const historyData = await historyRes.json();
      const prices: number[] = historyData.prices.map((p: any) => p[1]);
      
      if (prices.length === 0) throw new Error("No price data");

      const currentPrice = prices[prices.length - 1];
      setBtcPrice(currentPrice);
      updateTrend(currentPrice);

      const [fundingRes, mvrvRes, usdtRes] = await Promise.all([
        fetchFundingRate(),
        fetchMVRVZScore(prices),
        fetchUSDTDom()
      ]);

      const geoMean200 = calculateGeoMean(prices, 200) || currentPrice;
      const launchDate = new Date('2009-01-03').getTime();
      const now = Date.now();
      const daysSinceLaunch = (now - launchDate) / (1000 * 60 * 60 * 24);
      const expValuation = Math.pow(10, (5.84 * Math.log10(daysSinceLaunch)) - 17.01);
      const ahr999Value = (currentPrice / geoMean200) * (currentPrice / expValuation);

      const ma2Year = calculateSMA(prices, 730);
      let maMultiplierPos = 50; 
      if (ma2Year) {
          const ma2YearX5 = ma2Year * 5;
          const range = ma2YearX5 - ma2Year;
          const pos = ((currentPrice - ma2Year) / range) * 100;
          maMultiplierPos = Math.max(0, Math.min(100, pos));
      }

      const weeklyPrices = [];
      for(let i = prices.length - 1; i >= 0; i -= 7) {
          weeklyPrices.unshift(prices[i]);
      }
      const rsiValue = calculateRSI(weeklyPrices, 14);

      setInputs({
        mvrv: Number(mvrvRes.value.toFixed(2)),
        ahr999: Number(ahr999Value.toFixed(2)),
        maMultiplier: Number(maMultiplierPos.toFixed(0)),
        usdtDom: Number(usdtRes.value.toFixed(2)),
        funding: Number(fundingRes.value.toFixed(4)),
        rsi: Number(rsiValue.toFixed(0))
      });

      const sources = [
        `MVRV: ${mvrvRes.source}`,
        `Funding: ${fundingRes.source}`,
        `USDT: ${usdtRes.source}`
      ].join(', ');
      
      setDataSourceInfo(`已同步 (${sources})`);

    } catch (error) {
      console.warn("Primary API Failed, switching to Fallback.");
      await fetchFallbackData();
    } finally {
      setIsLoading(false);
      setCurrentDate(new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) + " " + new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }));
    }
  }, []);

  // --- CALCULATION ENGINE ---
  const results: CalculationResult = useMemo(() => {
    const breakdown = [];
    let totalScore = 0;

    // 1. MVRV
    const mvrvNorm = Math.min(Math.max((inputs.mvrv - (-1)) / (7 - (-1)) * 100, 0), 100);
    const mvrvWeighted = mvrvNorm * 0.30;
    breakdown.push({ id: 'mvrv', name: 'MVRV Z-Score', rawScore: mvrvNorm, weightedScore: mvrvWeighted });
    totalScore += mvrvWeighted;

    // 2. AHR999
    const ahrNorm = Math.min(Math.max((inputs.ahr999 - 0.45) / (10 - 0.45) * 100, 0), 100);
    const ahrWeighted = ahrNorm * 0.20;
    breakdown.push({ id: 'ahr999', name: 'AHR999', rawScore: ahrNorm, weightedScore: ahrWeighted });
    totalScore += ahrWeighted;

    // 3. MA Multiplier
    const maNorm = Math.min(Math.max(inputs.maMultiplier, 0), 100);
    const maWeighted = maNorm * 0.20;
    breakdown.push({ id: 'maMultiplier', name: '2年 MA 倍數', rawScore: maNorm, weightedScore: maWeighted });
    totalScore += maWeighted;

    // 4. USDT Dom
    const usdtNorm = Math.min(Math.max((8 - inputs.usdtDom) / (8 - 2) * 100, 0), 100);
    const usdtWeighted = usdtNorm * 0.15;
    breakdown.push({ id: 'usdtDom', name: 'USDT 市占率', rawScore: usdtNorm, weightedScore: usdtWeighted });
    totalScore += usdtWeighted;

    // 5. Funding
    const fundingAdjusted = Math.max(inputs.funding, 0); 
    const fundingNorm = Math.min(Math.max((fundingAdjusted / 0.1) * 100, 0), 100);
    const fundingWeighted = fundingNorm * 0.10;
    breakdown.push({ id: 'funding', name: '資金費率', rawScore: fundingNorm, weightedScore: fundingWeighted });
    totalScore += fundingWeighted;

    // 6. RSI
    const rsiNorm = Math.min(Math.max((inputs.rsi - 30) / (90 - 30) * 100, 0), 100);
    const rsiWeighted = rsiNorm * 0.05;
    breakdown.push({ id: 'rsi', name: '週線 RSI', rawScore: rsiNorm, weightedScore: rsiWeighted });
    totalScore += rsiWeighted;

    let advice = { title: "", color: "", description: "" };
    if (totalScore < 20) {
      advice = { title: "強力買入 (深度價值)", color: "text-green-500 border-green-500", description: "全倉買入 (ALL IN)。歷史底部區域。" };
    } else if (totalScore < 40) {
      advice = { title: "累積籌碼 (定投)", color: "text-lime-400 border-lime-400", description: "適合定期定額投資 (DCA) 的區域。" };
    } else if (totalScore < 65) {
      advice = { title: "觀望 (HODL)", color: "text-yellow-400 border-yellow-400", description: "中性區域。按兵不動。" };
    } else if (totalScore < 80) {
      advice = { title: "停止買入", color: "text-orange-500 border-orange-500", description: "市場過熱。" };
    } else {
      advice = { title: "賣出 (泡沫)", color: "text-red-500 border-red-500", description: "獲利了結。歷史頂部區域。" };
    }

    return { totalScore, breakdown, advice };
  }, [inputs]);

  // --- LATEST DATA REF (For Scheduler) ---
  const latestDataRef = useRef({ results, btcPrice, currentDate, inputs });
  
  // Update ref whenever critical data changes so the interval always sees the latest state
  useEffect(() => {
    latestDataRef.current = { results, btcPrice, currentDate, inputs };
  }, [results, btcPrice, currentDate, inputs]);

  // --- EMAIL BODY GENERATOR ---
  const generateEmailBody = (data: typeof latestDataRef.current) => {
    const { results, btcPrice, currentDate, inputs } = data;
    const priceStr = btcPrice 
        ? `$${btcPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` 
        : '資料讀取中';

    return `
【📅 ${currentDate} 市場快報】
💰 BTC 現價: ${priceStr}
📊 週期總分: ${results.totalScore.toFixed(1)} / 100
🌊 市場狀態: ${results.advice.title}
💡 操作建議: ${results.advice.description}

--------------------------------
[詳細指標數據]
• MVRV Z-Score: ${inputs.mvrv} (貢獻: ${results.breakdown.find(b => b.id === 'mvrv')?.weightedScore.toFixed(1)})
• AHR999 Index: ${inputs.ahr999} (貢獻: ${results.breakdown.find(b => b.id === 'ahr999')?.weightedScore.toFixed(1)})
• 2年 MA 倍數: ${inputs.maMultiplier}% (貢獻: ${results.breakdown.find(b => b.id === 'maMultiplier')?.weightedScore.toFixed(1)})
• USDT 市占率: ${inputs.usdtDom}% (貢獻: ${results.breakdown.find(b => b.id === 'usdtDom')?.weightedScore.toFixed(1)})
• 資金費率: ${inputs.funding}% (貢獻: ${results.breakdown.find(b => b.id === 'funding')?.weightedScore.toFixed(1)})
• 週線 RSI: ${inputs.rsi} (貢獻: ${results.breakdown.find(b => b.id === 'rsi')?.weightedScore.toFixed(1)})
    `.trim();
  };

  // --- MANUAL TEST SEND ---
  const handleManualSend = async () => {
    const email = localStorage.getItem('btc_monitor_email');
    if (!email) {
      alert("請先訂閱，設定 Email 後再進行測試。");
      return;
    }
    
    if(!window.confirm(`確定要立刻發送一封測試信件給 ${email} 嗎？`)) return;

    try {
        const messageBody = generateEmailBody(latestDataRef.current);
        const reportLink = window.location.origin;
        
        const res = await emailjs.send(
        EMAIL_SERVICE_ID,
        EMAIL_TEMPLATE_ID,
        {
            to_email: email,
            email: email,
            reply_to: email,
            message: messageBody,
            report_link: reportLink,
            subscription_date: new Date().toLocaleDateString() + ' (手動測試)'
        },
        EMAIL_PUBLIC_KEY
        );
        alert(`發送成功！\nServer 回應: ${res.text}`);
    } catch (err: any) {
        console.error(err);
        alert(`發送失敗。\n錯誤內容: ${JSON.stringify(err)}`);
    }
  };

  // --- SCHEDULER & EFFECTS ---

  // 1. Initial Load & Price Ticker
  useEffect(() => {
    const now = new Date();
    setCurrentDate(now.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) + " " + now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }));
    fetchDataOrchestrator();
    
    // Check local storage for status
    const lastSent = localStorage.getItem('btc_monitor_last_auto_sent');
    if (lastSent) setLastAutoSentDate(lastSent);

    const interval = setInterval(updateLivePriceOnly, 10000);
    return () => clearInterval(interval);
  }, [fetchDataOrchestrator]);

  // 2. Hourly Data Refresh
  useEffect(() => {
    const hourlyRefresh = setInterval(() => {
        console.log("Triggering hourly data refresh...");
        fetchDataOrchestrator();
    }, 3600000);
    return () => clearInterval(hourlyRefresh);
  }, [fetchDataOrchestrator]);

  // 3. CATCH-UP SCHEDULER
  // Logic: Check every 10 seconds. 
  // If time >= 8:00 AM AND "Last Sent Date" != "Today's Date", then SEND.
  useEffect(() => {
    const checkSchedule = async () => {
      const now = new Date();
      const currentHour = now.getHours();
      
      const email = localStorage.getItem('btc_monitor_email');
      const subscribed = localStorage.getItem('btc_monitor_subscription');
      const lastSentDate = localStorage.getItem('btc_monitor_last_auto_sent');
      
      const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

      // Update UI Status
      if (!subscribed || subscribed !== 'true') {
        setAutoSendStatus("未訂閱");
      } else if (lastSentDate === todayStr) {
        setAutoSendStatus(`今日已發送 (${lastSentDate})`);
      } else if (currentHour < 8) {
        setAutoSendStatus("等待早上 8:00...");
      } else {
        setAutoSendStatus("準備發送 (補發模式)...");
      }

      // TRIGGER CONDITION: Time >= 8 AM AND Not Sent Today
      if (currentHour >= 8) {
        if (email && subscribed === 'true' && lastSentDate !== todayStr) {
           console.log(`Catch-up Logic Triggered: It's after 8AM (${now.toLocaleTimeString()}) and report not sent today.`);
           
           try {
             // Use ref data to ensure we have *something* even if state is updating
             // Ideally we wait for data, but this loop runs often.
             if (!latestDataRef.current.btcPrice) {
                 console.log("Data not ready yet, waiting for next tick...");
                 return;
             }

             const messageBody = generateEmailBody(latestDataRef.current);
             const reportLink = window.location.origin;
             
             await emailjs.send(
                EMAIL_SERVICE_ID,
                EMAIL_TEMPLATE_ID,
                {
                  to_email: email,
                  email: email,
                  reply_to: email,
                  message: messageBody,
                  report_link: reportLink,
                  subscription_date: now.toLocaleDateString() + ' (自動/補發)'
                },
                EMAIL_PUBLIC_KEY
             );
             
             console.log("Auto report sent successfully.");
             localStorage.setItem('btc_monitor_last_auto_sent', todayStr);
             setLastAutoSentDate(todayStr);
             setAutoSendStatus(`今日已發送 (${todayStr})`);
             fetchDataOrchestrator(); 
             
           } catch (err: any) {
             console.error("Auto report failed details:", JSON.stringify(err));
             setAutoSendStatus("發送失敗 (請檢查 Console)");
           }
        }
      }
    };
    
    // Check more frequently (every 10s) to catch it as soon as user opens tab
    const scheduleTimer = setInterval(checkSchedule, 10000);
    return () => clearInterval(scheduleTimer);
  }, [fetchDataOrchestrator]);

  const handleInputChange = (key: keyof IndicatorState, value: number) => {
    setInputs(prev => ({ ...prev, [key]: value }));
    setDataSourceInfo("手動調整模式");
  };

  const getTrendStyles = () => {
    if (priceTrend === 'up') return { 
        bg: 'bg-green-500/10 hover:bg-green-500/20', 
        border: 'border-green-500/50', 
        text: 'text-green-400',
        icon: (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-500 animate-pulse"><path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" /></svg>)
    };
    if (priceTrend === 'down') return { 
        bg: 'bg-red-500/10 hover:bg-red-500/20', 
        border: 'border-red-500/50', 
        text: 'text-red-400',
        icon: (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-500 animate-pulse"><path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" /></svg>)
    };
    return { 
        bg: 'bg-slate-800/80 hover:bg-slate-700/80', 
        border: 'border-slate-600', 
        text: 'text-white',
        icon: (<span className="relative flex h-2.5 w-2.5 mr-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-500"></span></span>)
    };
  };

  const trendStyles = getTrendStyles();
  const reportLink = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-end border-b border-slate-700 pb-4 gap-4">
        <div className="text-center md:text-left w-full md:w-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-300">
            比特幣週期監控系統
          </h1>
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 mt-3">
            <p className="text-slate-400 text-sm">
              量化分析系統 v2.3 (Multi-Source)
            </p>
            {btcPrice && (
              <div className={`flex w-fit mx-auto md:mx-0 items-center justify-center md:justify-start gap-2 px-4 py-1.5 rounded-lg border shadow-lg shadow-black/20 transition-all ${trendStyles.bg} ${trendStyles.border}`}>
                  {trendStyles.icon}
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-mono font-bold tracking-wide transition-colors duration-300 ${trendStyles.text}`}>
                        ${btcPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">USD</span>
                  </div>
              </div>
            )}
          </div>
          {/* Status Indicator */}
          <div className="mt-2 text-xs font-mono text-slate-500">
             自動排程狀態: <span className={autoSendStatus.includes('已發送') ? 'text-green-400' : 'text-orange-400'}>{autoSendStatus}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 justify-end">
            <button 
                onClick={handleManualSend}
                className="px-3 py-3 rounded-xl font-bold bg-slate-800 text-slate-400 hover:text-white border border-slate-700 text-xs"
                title="測試 EmailJS 設定是否正確"
            >
                強制發送測試
            </button>
            <button 
            onClick={() => setIsSubscribeModalOpen(true)}
            className="px-4 py-3 rounded-xl font-bold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-600 transition-all flex items-center gap-2 whitespace-nowrap"
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            訂閱日報
            </button>
            <button 
            onClick={fetchDataOrchestrator}
            disabled={isLoading}
            className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${isLoading ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 active:transform active:scale-95'}`}
            >
            {isLoading ? (
                <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                計算中...
                </>
            ) : (
                <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                同步即時數據
                </>
            )}
            </button>
        </div>
      </header>

      <SubscribeModal 
        isOpen={isSubscribeModalOpen} 
        onClose={() => setIsSubscribeModalOpen(false)} 
        currentLink={reportLink}
        currentResults={results}
        currentPrice={btcPrice}
        currentDate={currentDate}
        inputs={inputs}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                市場指標數據
                </h2>
                <span className="text-xs text-slate-400 border border-slate-700 px-2 py-1 rounded-md">
                    來源: {dataSourceInfo}
                </span>
            </div>
            <InputSlider label="MVRV Z-Score (代理)" description="優先使用 Blockchain.info，若受限則使用 200WMA 代理。" value={inputs.mvrv} min={-1} max={7} step={0.1} unit="" weight={30} onChange={(v) => handleInputChange('mvrv', v)} detailedInfo="MVRV Z-Score 衡量市值與實現價值的偏離度。本系統優先抓取鏈上數據 API，若瀏覽器受 CORS 限制，則自動切換至「價格/200週均線」高精度模型進行估算。" />
            <InputSlider label="AHR999 Index (實時計算)" description="基於價格、200天幾何平均與幣齡指數運算。" value={inputs.ahr999} min={0.45} max={10} step={0.05} unit="" weight={20} onChange={(v) => handleInputChange('ahr999', v)} detailedInfo="AHR999 = (價格/200日幾何平均) * (價格/指數增長估值)。指數增長估值 = 10^(5.84 * log10(幣齡) - 17.01)。此指標專為識別長期抄底 (0.45) 與頂部 (10.0) 設計。" />
            <InputSlider label="2-Year MA Multiplier (實時)" description="基於過去 730 天價格計算。" value={inputs.maMultiplier} min={0} max={100} step={1} unit="%" weight={20} onChange={(v) => handleInputChange('maMultiplier', v)} detailedInfo="系統自動獲取過去 730 天每日收盤價計算 2年均線 (綠線)。0% 代表價格位於綠線，100% 代表價格位於綠線的 5 倍 (紅線)。" />
            <InputSlider label="USDT Dominance (USDT 市占率)" description="實時全球市值數據。低 % = 貪婪，高 % = 恐懼。" value={inputs.usdtDom} min={2} max={8} step={0.1} unit="%" weight={15} onChange={(v) => handleInputChange('usdtDom', v)} inverse={true} detailedInfo="數據源自 CoinGecko Global API。USDT 市占率與比特幣價格通常呈負相關。數值越高代表資金撤出市場 (恐慌/買點)，數值越低代表資金全倉買入 (貪婪/賣點)。" />
            <InputSlider label="Funding Rate (資金費率)" description="Binance/Bybit 永續合約實時費率。" value={inputs.funding} min={-0.02} max={0.12} step={0.001} unit="%" weight={10} onChange={(v) => handleInputChange('funding', v)} detailedInfo="優先嘗試 Binance BTCUSDT 費率，若受限則切換至 Bybit。正費率過高 (>0.05%) 表示多頭過度槓桿；費率為負則表示市場看空情緒濃厚。" />
            <InputSlider label="Weekly RSI (週線 RSI)" description="基於每日收盤價重採樣計算 14 週 RSI。" value={inputs.rsi} min={30} max={90} step={1} unit="" weight={5} onChange={(v) => handleInputChange('rsi', v)} detailedInfo="系統將每日價格數據重組為週線 (7天)，並執行標準 14 週期 RSI 算法。RSI > 70 為超買，< 30 為超賣。" />
          </div>
        </div>
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-8 rounded-2xl text-center shadow-2xl shadow-orange-500/10 relative overflow-hidden">
            <div className="flex flex-col items-center gap-3 mb-4">
                <div className="inline-block px-4 py-1 bg-slate-800 rounded-full border border-slate-600">
                   <span className="text-slate-400 text-xs font-mono mr-2">📅 數據日期:</span>
                   <span className="text-orange-300 font-bold font-mono">{currentDate}</span>
                </div>
                {btcPrice && (
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-colors duration-300 ${trendStyles.bg} ${trendStyles.border}`}>
                     <span className={`text-xs font-bold font-mono ${trendStyles.text}`}>BTC 現價:</span>
                     <span className={`font-mono font-bold text-lg ${trendStyles.text}`}>${btcPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                     <div className="scale-75 origin-left">{trendStyles.icon}</div>
                  </div>
                )}
            </div>
            <h2 className="text-slate-400 text-sm font-semibold uppercase tracking-widest mt-2 mb-4">當前市場週期狀態</h2>
            <ScoreGauge score={results.totalScore} adviceTitle={results.advice.title} adviceColor={results.advice.color} />
            <p className="mt-4 text-slate-300 italic">"{results.advice.description}"</p>
          </div>
          <div className="glass-panel p-6 rounded-2xl">
            <BreakdownChart data={results.breakdown as any} />
          </div>
          <div className="bg-slate-900/50 p-4 rounded-xl text-xs text-slate-500 border border-slate-800">
            <h4 className="font-bold text-slate-400 mb-2">關於數據來源 (多源備援)：</h4>
            <p className="mb-2">1. 鏈上/合約數據：<span className="text-white">Binance, Blockchain.info, Bybit</span> (自動切換)。</p>
            <p className="mb-2">2. 價格歷史：<span className="text-white">CoinGecko (Full History)</span> 用於運算 AHR999。</p>
            <p className="mb-2">3. MVRV Z-Score：若 API 連線受限，系統自動採用 <span className="text-orange-400">200週均線估算模型</span>。</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
