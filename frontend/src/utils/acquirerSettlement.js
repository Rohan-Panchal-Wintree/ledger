const emptyDraft = () => ({ individual: {}, sharedEnabled: {}, sharedValues: {} });

export const getRateDraft = (drafts, target) => drafts[target] || emptyDraft();

const updateDraft = (drafts, target, update) => ({
	...drafts,
	[target]: update(getRateDraft(drafts, target)),
});

export const getCurrencyOwners = (acquirers) => {
	const owners = {};
	for (const item of acquirers) {
		for (const row of item.currencies) {
			owners[row.currency] ||= [];
			owners[row.currency].push(item.acquirer);
		}
	}
	return owners;
};

export const getEffectiveRate = (drafts, target, acquirer, currency) => {
	if (currency === target) return "1";
	const draft = getRateDraft(drafts, target);
	return draft.sharedEnabled[currency]
		? draft.sharedValues[currency] ?? ""
		: draft.individual[acquirer]?.[currency] ?? "";
};

export const setIndividualRate = (drafts, target, acquirer, currency, value) =>
	updateDraft(drafts, target, (draft) => ({
		...draft,
		individual: {
			...draft.individual,
			[acquirer]: { ...draft.individual[acquirer], [currency]: value },
		},
	}));

export const setSharedRate = (drafts, target, currency, value) =>
	updateDraft(drafts, target, (draft) => ({
		...draft, sharedValues: { ...draft.sharedValues, [currency]: value },
	}));

const validRate = (rate) =>
	String(rate ?? "").trim() !== "" && Number.isFinite(Number(rate)) && Number(rate) > 0;

export const toggleSharedRate = (drafts, target, currency, owners, checked) => {
	if (currency === target) return drafts;
	return updateDraft(drafts, target, (draft) => {
		const individual = { ...draft.individual };
		const sharedValues = { ...draft.sharedValues };
		if (checked) {
			const values = owners.map((owner) => draft.individual[owner]?.[currency] ?? "");
			// Differing individual rates stay saved until a shared rate is explicitly entered.
			sharedValues[currency] = values.length && validRate(values[0]) &&
				values.every((value) => validRate(value) && Number(value) === Number(values[0]))
				? values[0] : "";
		} else if (validRate(draft.sharedValues[currency])) {
			for (const owner of owners) {
				individual[owner] = { ...individual[owner], [currency]: draft.sharedValues[currency] };
			}
		}
		return { ...draft, individual, sharedValues,
			sharedEnabled: { ...draft.sharedEnabled, [currency]: checked } };
	});
};

const acquirerTarget = (currencies, acquirer) =>
	typeof currencies === "string" ? currencies : currencies?.[acquirer] || "EUR";

export const getConversionRateGroups = (acquirers, currencies) => {
	const groups = new Map();
	for (const item of acquirers) {
		const target = acquirerTarget(currencies, item.acquirer);
		for (const row of item.currencies) {
			if (row.currency === target) continue;
			const key = `${row.currency}__${target}`;
			if (!groups.has(key)) groups.set(key, { currency: row.currency, settlementCurrency: target, owners: [] });
			groups.get(key).owners.push(item.acquirer);
		}
	}
	return [...groups.values()];
};

export const changeAcquirerTarget = (settings, acquirers, acquirer, target) => {
	if (!["EUR", "USDT"].includes(target)) return settings;
	const previousTarget = acquirerTarget(settings.currencies, acquirer);
	let drafts = settings.drafts;
	// Save the effective old-target values before leaving a shared-rate group.
	for (const row of acquirers.find((item) => item.acquirer === acquirer)?.currencies || []) {
		const rate = getEffectiveRate(drafts, previousTarget, acquirer, row.currency);
		if (validRate(rate)) drafts = setIndividualRate(drafts, previousTarget, acquirer, row.currency, rate);
	}
	const currencies = { ...settings.currencies, [acquirer]: target };
	for (const [payoutCurrency, draft] of Object.entries(drafts)) {
		for (const [sourceCurrency, enabled] of Object.entries(draft.sharedEnabled)) {
			if (!enabled) continue;
			const owners = acquirers.filter((item) => acquirerTarget(currencies, item.acquirer) === payoutCurrency &&
				item.currencies.some((row) => row.currency === sourceCurrency)).map((item) => item.acquirer);
			if (owners.length < 2) drafts = toggleSharedRate(drafts, payoutCurrency, sourceCurrency, owners, false);
		}
	}
	return { currencies, drafts };
};

export const buildAcquirerConversionPreview = (acquirers, drafts, target) => {
	const ratesByAcquirer = {};
	const settlementCurrenciesByAcquirer = {};
	const groups = acquirers.map((item) => {
		const settlementCurrency = acquirerTarget(target, item.acquirer);
		settlementCurrenciesByAcquirer[item.acquirer] = settlementCurrency;
		const rates = {};
		const rows = item.currencies.map((row) => {
			const rawRate = getEffectiveRate(drafts, settlementCurrency, item.acquirer, row.currency);
			const rate = Number(rawRate);
			const netPayable = Number(row.netPayable);
			const product = netPayable * rate;
			// Mirror the backend roundMoney(), followed by toCents(), including negatives.
			const rounded = Math.round((product + Number.EPSILON) * 100) / 100;
			const convertedCents = Math.round((rounded + Number.EPSILON) * 100);
			const valid = validRate(rawRate) && row.netPayable !== null && row.netPayable !== undefined &&
				Number.isFinite(netPayable) && Number.isFinite(product) && Number.isSafeInteger(convertedCents);
			rates[row.currency] = row.currency === settlementCurrency ? "1" : rawRate;
			return { ...row, rate, valid, convertedCents: valid ? convertedCents : 0 };
		});
		ratesByAcquirer[item.acquirer] = rates;
		const totalCents = rows.reduce((sum, row) => sum + row.convertedCents, 0);
		return { acquirer: item.acquirer, settlementCurrency, rows, totalCents,
			valid: ["EUR", "USDT"].includes(settlementCurrency) && rows.length > 0 && rows.every((row) => row.valid) && Number.isSafeInteger(totalCents) };
	});
	const totals = new Map();
	for (const group of groups) totals.set(group.settlementCurrency, (totals.get(group.settlementCurrency) || 0) + group.totalCents);
	const totalsByCurrency = [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, totalCents: amount }));
	return { groups, totalsByCurrency, totalCents: totalsByCurrency.length === 1 ? totalsByCurrency[0].totalCents : null,
		ratesByAcquirer, settlementCurrenciesByAcquirer,
		valid: groups.length > 0 && groups.every((group) => group.valid) && totalsByCurrency.every((row) => Number.isSafeInteger(row.totalCents)) };
};
