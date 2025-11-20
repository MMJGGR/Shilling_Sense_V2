import { extractHeuristicData } from './services/heuristicService';

const testCases = [
    "IBKG MPESA PAY TO 254117449222-MOBILE MONEY KE-IBNK-HAOSP9 KE-016-251119-213837517-051220-045",
    "DEBIT CARD TXN AT UBER * PENDING AMSTERDAM     17-11-2025 / 08:52:09 47-83-9408 16530408 4783940816530408",
    "DEBIT CARD TXN AT ZUCCHINI  LIMIT NAIROBI       14-11-2025 / 14:22:07 47-83-9408 16530408 4783940816530408",
    "KE-013-251113-140132692-693070-871 FRANCIS HAIR SALON AND WEAVE BAR| 000200572025111314013497F6D5EA|PESA|0057 RICHARD CONTRIBUTION",
    "IBKG MPESA PAY TO 254718460149-MOBILE MONEY KE-IBNK-0VXOA1 KE-016-251117-172048248-416263-475",
    "IBKG MPESA PAY TO 254718460149-AIRTIME KE-IBNK-BK4DFA KE-016-251020-090019019-618247-640",
    "DEBIT CARD TXN AT MAF 8144 TILL 2 NAIROBI       12-11-2025 / 14:21:29 47-83-9408 16530408 4783940816530408"
];

console.log("Running Heuristic Extraction Tests...");

testCases.forEach((desc, index) => {
    const result = extractHeuristicData(desc);
    console.log(`\nTest Case ${index + 1}:`);
    console.log(`Input: "${desc}"`);
    console.log(`Extracted Merchant: "${result.merchant}"`);
    console.log(`Cache Key: "${result.cacheKey}"`);
});
