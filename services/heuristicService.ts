
// Defines the result from heuristic extraction.
export interface HeuristicData {
    merchant: string | null; // The extracted merchant name, if any.
    cacheKey: string;      // The string to use for caching, e.g., "Naivas" or a cleaned description.
}

// Rules to extract merchant names. The order is important.
const merchantExtractors = [
    { regex: /Lipa na M-PESA to (.+?)(?: Transaction ID:|$)/i, group: 1 },
    { regex: /Pay Bill to (.+?)(?: Acc No\..*|$)/i, group: 1 },
    { regex: /M-PESA Paybill, (.+?),/i, group: 1 },
    { regex: /Card Purchase at (.+?)(?: on .*|$)/i, group: 1 },
    { regex: /Withdrawal from Agent ([\d\w\s-]+?)(?: at .*|$)/i, group: 1, prefix: 'Agent ' },
    // New patterns for the user's bank format
    { regex: /KE-[\d-]+\s+([A-Z][A-Z\s&]+?)(?=\s+(?:\d|PESA)|\|)/i, group: 1 }, // Matches "KE-013-... FRANCIS HAIR SALON AND WEAVE BAR ..." (stops before " \d"/" PESA"/"|")
    { regex: /DEBIT CARD TXN AT (.+?)(?:\s{2,}|\d{2}-\d{2}-\d{4})/i, group: 1 }, // Matches debit card transactions
    { regex: /IBANKING TRF (?:TO|FROM) \d+ (.+?)$/i, group: 1 }, // Matches "IBANKING TRF TO 8700351857200 IBKR"
    { regex: /PESA \S+ (.+?) \d{4}/i, group: 1 }, // Matches "PESA 00370002... KEVIN GITHWE 0063..."
    { regex: /RTGS .+ ITF (.+?) KE/i, group: 1 }, // Matches "RTGS FT... SBK ITF SANLAM UNIT TRUST SCHEME KE..."
];

// Regex to find points
const pointsExtractors = [
    // "You have earned 20 points. Total points: 450"
    { regex: /Total points:?\s*([\d,]+)/i, group: 1 },
    // "Bonga Points Bal: 1020"
    { regex: /Points Bal:?\s*([\d,]+)/i, group: 1 },
    // "Points Balance: 500"
    { regex: /Points Balance:?\s*([\d,]+)/i, group: 1 },
];

export const extractHeuristicData = (description: string): HeuristicData => {
    const trimmedDescription = description.trim();

    for (const extractor of merchantExtractors) {
        const match = trimmedDescription.match(extractor.regex);
        if (match && match[extractor.group]) {
            const merchant = ((extractor.prefix || '') + match[extractor.group].trim()).replace(/\s+/g, ' ');
            const cacheKey = merchant;
            return { merchant, cacheKey };
        }
    }
    return { merchant: null, cacheKey: trimmedDescription };
};

export const extractPointsFromDescription = (description: string): number | null => {
    for (const extractor of pointsExtractors) {
        const match = description.match(extractor.regex);
        if (match && match[extractor.group]) {
            // Remove commas and parse
            return parseInt(match[extractor.group].replace(/,/g, ''), 10);
        }
    }
    return null;
};
