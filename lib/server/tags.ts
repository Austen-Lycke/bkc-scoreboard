/** Cache tags for the public pages; revalidated after every sync. */
export const tags = {
  competitions: "competitions",
  competition: (id: string) => `competition:${id}`,
  season: (year: number) => `season:${year}`,
  shooters: "shooters",
};
