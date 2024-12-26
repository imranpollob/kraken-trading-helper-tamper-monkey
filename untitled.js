// ==UserScript==
// @name         Kraken Pro Trade Helper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Example script for Kraken Pro Trade
// @author       Your Name
// @match        https://pro.kraken.com/app/trade/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js
// ==/UserScript==

function tradeSummaryWithFractional(coinPrice, investmentAmount, currentCoinPrice = null, feePercent = 0.25) {
    // Convert parameters to floats
    coinPrice = parseFloat(coinPrice);
    investmentAmount = parseFloat(investmentAmount);
    currentCoinPrice = currentCoinPrice ? parseFloat(currentCoinPrice) : null;
    feePercent = parseFloat(feePercent);

    console.log(coinPrice, investmentAmount, currentCoinPrice, feePercent);

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
    //results.push(`Price: ${coinPrice.toFixed(3)}`);
    //results.push(`Paid: ${investmentAmount.toFixed(3)}`);
    results.push(`Break Even: ${breakEvenPrice.toFixed(3)}`);

    if (currentCoinPrice) {
        results.push(`${percentageProfitLoss.toFixed(2)}%: $${currentCoinPrice.toFixed(3)} ($${profitAtCurrent.toFixed(3)})`);
    }

    for (const gain in targetPrices) {
        results.push(`${gain}%: $${targetPrices[gain].toFixed(3)} ($${profits[gain].toFixed(3)})`);
    }

    return results;
}

(function () {
    "use strict";

    console.log("Kraken Pro Trade Helper script activated.");

    const initReactApp = () => {
        // Ensure React and ReactDOM are available globally
        const React = window.React;
        const ReactDOM = window.ReactDOM;

        if (!React || !ReactDOM) {
            console.error("React or ReactDOM not loaded properly.");
            return;
        }

        // React Component
        const CryptoProfitCalculator = () => {
            const [coinPrice, setCoinPrice] = React.useState(0);
            const [totalInvested, setTotalInvested] = React.useState(0);
            const [boughtPrice, setBoughtPrice] = React.useState(0);
            const [results, setResults] = React.useState(null);

            // Fetch input values from the page
            const fetchInputValues = () => {
                const existingCoinPrice = parseFloat(document.querySelector("#price-2")?.value || 0);
                const existingTotalInvested = parseFloat(document.querySelector("#volumeInQuote-4")?.value || 0);
                setCoinPrice(existingCoinPrice);
                setTotalInvested(existingTotalInvested);
            };

            // Fetch initial values on component mount
            React.useEffect(() => {
                fetchInputValues(); // Fetch initial values
            }, []); // Empty dependency array ensures this runs only once

            // Observe DOM changes
            React.useEffect(() => {
                const coinPriceElement = document.querySelector("#price-2");
                const totalInvestedElement = document.querySelector("#volumeInQuote-4");

                if (coinPriceElement && totalInvestedElement) {
                    const observer = new MutationObserver(fetchInputValues);

                    observer.observe(coinPriceElement, { attributes: true, attributeFilter: ["value"] });
                    observer.observe(totalInvestedElement, { attributes: true, attributeFilter: ["value"] });

                    return () => observer.disconnect();
                }
            }, []);

            // Update calculations when values change
            React.useEffect(() => {
                if (coinPrice > 0 && totalInvested > 0) {
                    const calculationResults = tradeSummaryWithFractional(coinPrice, totalInvested, boughtPrice);
                    setResults(calculationResults);
                }
            }, [coinPrice, totalInvested, boughtPrice]);

            return React.createElement(
                "div",
                null,
                React.createElement("p", null, "Limit Price: ", React.createElement("strong", null, coinPrice)),
                React.createElement("p", null, "Total Invested: ", React.createElement("strong", null, totalInvested)),
                React.createElement("label", { htmlFor: "bought-price" }, "Bought Price:"),
                React.createElement("input", {
                    type: "number",
                    id: "bought-price",
                    value: boughtPrice,
                    onChange: (e) => setBoughtPrice(parseFloat(e.target.value) || 0),
                    style: {
                        backgroundColor: "#333",
                        color: "#fff",
                        border: "1px solid rgba(255, 255, 255, 0.2)", // Optional light border for better contrast
                    },
                }),
                results &&
                    React.createElement(
                        "div",
                        null,
                        results.map((result, index) => React.createElement("p", { key: index }, result))
                    )
            );
        };

        // Target a container in the DOM
        const targetContainer = document.querySelector(".flex.flex-col.gap-y-2.pt-2");
        if (targetContainer) {
            const appContainer = document.createElement("div");
            targetContainer.appendChild(appContainer);
            ReactDOM.render(React.createElement(CryptoProfitCalculator), appContainer);
        } else {
            console.error("Target container not found.");
        }
    };

    // Delay script execution until DOM is ready
    const interval = setInterval(() => {
        if (document.querySelector(".flex.flex-col.gap-y-2.pt-2")) {
            clearInterval(interval);
            initReactApp();
        }
    }, 5000);
})();
