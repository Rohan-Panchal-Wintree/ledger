import React from "react";
import { CalendarDays } from "lucide-react";

const wiresheets = [
  {
    id: 1,
    name: "Weekly Settlement Report",
    period: "Oct 1 - Oct 7, 2023",
    uploadedDate: "14 Apr 2026",
    total: "1,250,400.00",
    currencies: [
      { currency: "EUR", amount: "450,000.00" },
      { currency: "USD", amount: "800,400.00" },
      { currency: "GBP", amount: "0.00" },
    ],
  },
  {
    id: 2,
    name: "Global Liquidity Audit",
    period: "Sep 24 - Sep 30, 2023",
    uploadedDate: "14 Apr 2026",
    total: "892,150.75",
    currencies: [
      { currency: "EUR", amount: "122,150.75" },
      { currency: "USD", amount: "770,000.00" },
    ],
  },
  {
    id: 3,
    name: "Q3 Regional Distribution",
    period: "Jul 1 - Sep 30, 2023",
    uploadedDate: "13 Apr 2026",
    total: "4,720,000.00",
    currencies: [
      { currency: "EUR", amount: "2,200,000.00" },
      { currency: "USD", amount: "2,520,000.00" },
    ],
  },
  {
    id: 4,
    name: "Corporate Tax Reserve",
    period: "Sep 1 - Sep 30, 2023",
    uploadedDate: "13 Apr 2026",
    total: "310,000.00",
    currencies: [{ currency: "USD", amount: "310,000.00" }],
  },
];

const groupedWiresheets = wiresheets.reduce((groups, sheet) => {
  if (!groups[sheet.uploadedDate]) {
    groups[sheet.uploadedDate] = [];
  }

  groups[sheet.uploadedDate].push(sheet);
  return groups;
}, {});

const Wiresheets = () => {
  return (
    <div className="w-full bg-background text-on-background">
      <main className="space-y-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-on-surface">
            Wiresheets Data
          </h1>
          <p className="mt-1 text-sm font-medium text-on-surface-variant">
            Review uploaded wiresheets grouped by upload date, period, and
            currency totals.
          </p>
        </div>

        <section className="space-y-8">
          {Object.entries(groupedWiresheets).map(([uploadedDate, sheets]) => (
            <div key={uploadedDate} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <CalendarDays className="text-primary" size={16} />
                <h2 className="text-md font-bold text-on-surface-variant">
                  Uploaded on {uploadedDate}
                </h2>
              </div>

              <div className="overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
                <div className="divide-y divide-outline-variant/5">
                  {sheets.map((sheet) => (
                    <div key={sheet.id} className="px-6 py-8">
                      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-xl font-bold tracking-tight text-on-surface">
                            {sheet.name}
                          </h3>
                          <p className="mt-1 text-sm font-medium text-on-surface-variant">
                            {sheet.period}
                          </p>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="text-2xl font-black tracking-tight text-on-surface">
                            {sheet.total}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-12 overflow-x-auto pb-2 scrollbar-hide ">
                        {sheet.currencies.map((item) => (
                          <div
                            key={`${sheet.id}-${item.currency}`}
                            className="flex min-w-fit flex-col gap-1"
                          >
                            <span className="text-[15px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                              {item.currency}
                            </span>

                            <span className="text-sm font-bold text-on-surface">
                              {item.amount}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
};

export default Wiresheets;
