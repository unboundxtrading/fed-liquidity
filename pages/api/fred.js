export default async function handler(req, res) {
  const { ids, start } = req.query;
  if (!ids) return res.status(400).json({ error: "missing ids param" });

  const seriesList = ids.split(",");
  const cosd = start || "2024-12-01";

  try {
    const results = {};
    await Promise.all(
      seriesList.map(async (id) => {
        const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${cosd}`;
        const r = await fetch(url);
        if (!r.ok) {
          results[id] = { error: r.status };
          return;
        }
        const text = await r.text();
        const rows = text.trim().split("\n").slice(1);
        results[id] = rows
          .map((line) => {
            const [date, val] = line.split(",");
            const v = parseFloat(val);
            if (!date || date === "." || isNaN(v)) return null;
            return { date, value: v };
          })
          .filter(Boolean);
      })
    );

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    res.status(200).json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
