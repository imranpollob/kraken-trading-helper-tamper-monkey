// ==UserScript==
// @name         Kraken Pro Trade Helper
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Calculate profitable selling prices for trades on Kraken Pro.
// @author       Imran Pollob
// @license      MIT
// @match        https://pro.kraken.com/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js
// ==/UserScript==

function tradeSummaryWithFractional(coinPrice, investmentAmount, currentCoinPrice = null) {
    // Convert parameters to floats
    coinPrice = parseFloat(coinPrice);
    investmentAmount = parseFloat(investmentAmount);
    currentCoinPrice = currentCoinPrice ? parseFloat(currentCoinPrice) : null;
    const anchorElement = document.querySelector('a[href*="fee-level"]');
    const spanElements = anchorElement.querySelectorAll(".text-ds-primary.text-ds-labelMono3");
    const makerFee = spanElements[0].firstElementChild.textContent;
    const feePercent = parseFloat(makerFee);

    // console.log(coinPrice, investmentAmount, currentCoinPrice, feePercent);

    // Input validation
    if (coinPrice <= 0 || investmentAmount <= 0 || feePercent < 0) {
        throw new Error("Invalid input: coinPrice, investmentAmount must be > 0 and feePercent >= 0");
    }

    // Step 1: Calculate the fractional quantity bought
    const quantity = investmentAmount / coinPrice;
    const buyFee = investmentAmount * (feePercent / 100); // Fee for buying
    const actualTotalCost = investmentAmount + buyFee;
    const actualPricePerUnit = actualTotalCost / quantity;

    // Step 2: Break-even Selling Price
    const breakEvenPrice = actualPricePerUnit / (1 - feePercent / 100);

    // Step 3: Calculate Target Prices for Gains
    const targetPrices = {};
    const profits = {};
    const netSellValues = {};
    for (let gain = 1; gain <= 5; gain++) {
        // Gains from 1% to 5%
        const targetPrice = breakEvenPrice * (1 + gain / 100);
        const sellFeeAtTarget = targetPrice * quantity * (feePercent / 100);
        const totalSellValueAtTarget = targetPrice * quantity - sellFeeAtTarget;
        const profitAtTarget = totalSellValueAtTarget - actualTotalCost;
        targetPrices[gain] = targetPrice;
        profits[gain] = profitAtTarget;
        netSellValues[gain] = totalSellValueAtTarget;
    }

    // Step 4: Profit/Loss at Current Coin Price (if provided)
    let profitAtCurrent;
    let percentageProfitLoss;
    let totalSellValueAtCurrent;
    if (currentCoinPrice) {
        const sellFeeAtCurrent = currentCoinPrice * quantity * (feePercent / 100); // Sell fee at current price
        totalSellValueAtCurrent = currentCoinPrice * quantity - sellFeeAtCurrent; // Net sell value
        profitAtCurrent = totalSellValueAtCurrent - actualTotalCost; // Profit or loss at current price
        percentageProfitLoss = (profitAtCurrent / actualTotalCost) * 100; // Percentage profit/loss
    } else {
        profitAtCurrent = null;
        percentageProfitLoss = null;
        totalSellValueAtCurrent = null;
    }

    // Prepare results for React
    const results = [];

    if (currentCoinPrice) {
        results.push({
            percentage: percentageProfitLoss,
            price: currentCoinPrice,
            net: profitAtCurrent,
        });
    }

    for (const gain in targetPrices) {
        results.push({
            percentage: gain,
            price: targetPrices[gain],
            net: profits[gain],
        });
    }

    return [breakEvenPrice, results];
}

(function () {
    "use strict";

    const initReactApp = () => {
        // Ensure React and ReactDOM are available globally
        const React = window.React;
        const ReactDOM = window.ReactDOM;

        if (!React || !ReactDOM) {
            console.error("React or ReactDOM not loaded properly.");
            return;
        }

        const ResultRow2 = ({ label, value }) => {
            return React.createElement(
                "div",
                { className: "flex justify-between items-center h-4" },
                React.createElement(
                    "div",
                    { className: "text-ds text-ds-body3 ms-ds-0 me-ds-2 mt-ds-0 mb-ds-0" },
                    label
                ),
                React.createElement(
                    "div",
                    { className: "text-ds text-ds-body3 ms-ds-0 me-ds-0 mt-ds-0 mb-ds-0" },
                    value
                )
            );
        };

        const ResultRow3 = ({ percentage, price, net }) => {
            return React.createElement(
                "div",
                { className: "flex justify-between items-center h-4" },
                React.createElement(
                    "div",
                    { className: "text-ds text-ds-body3 ms-ds-0 me-ds-2 mt-ds-0 mb-ds-0" },
                    percentage
                ),
                React.createElement(
                    "div",
                    { className: "text-ds text-ds-body3 ms-ds-0 me-ds-2 mt-ds-0 mb-ds-0" },
                    price
                ),
                React.createElement("div", { className: "text-ds text-ds-body3 ms-ds-0 me-ds-0 mt-ds-0 mb-ds-0" }, net)
            );
        };

        // React Component
        const CryptoProfitCalculator = () => {
            const [coinPrice, setCoinPrice] = React.useState(0);
            const [totalInvested, setTotalInvested] = React.useState(0);
            const [boughtPrice, setBoughtPrice] = React.useState("");
            const [breakEvenPrice, setBreakEvenPrice] = React.useState(0);
            const [results, setResults] = React.useState(null);

            // Fetch input values from the page
            const fetchInputValues = () => {
                const existingCoinPrice = parseFloat(document.querySelector('[id^="price-"]')?.value || 0);
                const existingTotalInvested = parseFloat(document.querySelector('[id^="volumeInQuote-"]')?.value || 0);
                setCoinPrice(existingCoinPrice);
                setTotalInvested(existingTotalInvested);
            };

            // Fetch initial values on component mount
            React.useEffect(() => {
                fetchInputValues(); // Fetch initial values
            }, []); // Empty dependency array ensures this runs only once

            // Observe DOM changes
            React.useEffect(() => {
                const coinPriceElement = document.querySelector('[id^="price-"]');
                const totalInvestedElement = document.querySelector('[id^="volumeInQuote-"]');

                if (coinPriceElement && totalInvestedElement) {
                    const observer = new MutationObserver(fetchInputValues);

                    observer.observe(coinPriceElement, { attributes: true, attributeFilter: ["value"] });
                    observer.observe(totalInvestedElement, { attributes: true, attributeFilter: ["value"] });

                    return () => observer.disconnect();
                }
            }, []);

            // Update calculations when values change
            React.useEffect(() => {
                const parsedBoughtPrice = boughtPrice !== "" ? parseFloat(boughtPrice) : null;
                if (coinPrice > 0 && totalInvested > 0) {
                    const [calculatedBreakEvenPrice, calculatedResults] = tradeSummaryWithFractional(
                        coinPrice,
                        totalInvested,
                        boughtPrice
                    );
                    setBreakEvenPrice(calculatedBreakEvenPrice);
                    setResults(calculatedResults);
                }
            }, [coinPrice, totalInvested, boughtPrice]);

            const formatCurrency = (value, digits = 5, locale = "en-US", currency = "USD") => {
                return new Intl.NumberFormat(locale, {
                    style: "decimal",
                    currency: currency,
                    minimumFractionDigits: digits,
                    maximumFractionDigits: digits,
                }).format(value);
            };

            return React.createElement(
                "div",
                { className: "flex flex-col gap-y-2 pt-2 border-t border-dimmed" },
                // React.createElement(ResultRow2, { label: "Coin Price", value: coinPrice }),
                // React.createElement(ResultRow2, { label: "Total", value: totalInvested }),
                React.createElement(ResultRow2, { label: "Break Even Price:", value: formatCurrency(breakEvenPrice) }),
                React.createElement(ResultRow2, {
                    label: React.createElement("label", { htmlFor: "bought-price" }, "Expected Price:"),
                    value: React.createElement("input", {
                        type: "number",
                        id: "bought-price",
                        value: boughtPrice,
                        onChange: (e) => setBoughtPrice(e.target.value),
                        style: {
                            backgroundColor: "#333",
                            color: "#fff",
                            border: "1px solid rgba(255, 255, 255, 0.2)", // Optional styling
                        },
                    }),
                }),
                results &&
                    React.createElement(
                        "div",
                        { className: "flex flex-col gap-y-2" },
                        results.map((result, index) =>
                            React.createElement(ResultRow3, {
                                key: index,
                                percentage: `${parseFloat(result.percentage).toFixed(2)}%`,
                                price: formatCurrency(result.price),
                                net: formatCurrency(result.net, 2),
                            })
                        )
                    )
            );
        };

        // Target a container in the DOM
        const targetContainer = document.querySelector(".flex.flex-col.gap-y-2.pt-2");
        if (targetContainer) {
            const appContainer = document.createElement("div");
            appContainer.id = "trading-helper";
            targetContainer.appendChild(appContainer);
            ReactDOM.render(React.createElement(CryptoProfitCalculator), appContainer);
        } else {
            console.error("Target container not found.");
        }
    };

    const initializeScript = () => {
        const observer = new MutationObserver((mutations, obs) => {
            const targetElement = document.querySelector('a[href*="fee-level"]');
            if (targetElement) {
                if (!document.getElementById("trading-helper")) {
                    console.log("Trading helper is starting");
                    initReactApp();
                }

                obs.disconnect();
            }
        });

        // Start observing the entire document body for changes
        observer.observe(document.body, { childList: true, subtree: true });
    };

    // Initial script execution
    initializeScript();

    // Detect URL changes
    const observeUrlChanges = () => {
        let currentUrl = window.location.href;

        // Observe for changes in history state (pushState/replaceState)
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function (...args) {
            originalPushState.apply(this, args);
            window.dispatchEvent(new Event("urlchange"));
        };

        history.replaceState = function (...args) {
            originalReplaceState.apply(this, args);
            window.dispatchEvent(new Event("urlchange"));
        };

        // Listen for back/forward navigation (popstate)
        window.addEventListener("popstate", () => {
            if (currentUrl !== window.location.href) {
                currentUrl = window.location.href;
                initializeScript();
            }
        });

        // Listen for custom 'urlchange' event
        window.addEventListener("urlchange", () => {
            if (currentUrl !== window.location.href) {
                currentUrl = window.location.href;
                initializeScript();
            }
        });
    };

    // Start observing URL changes
    observeUrlChanges();
})();
