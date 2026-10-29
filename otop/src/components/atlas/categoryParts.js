export function categoryParts(scope) {
  return scope.categories.map((c) => ({ id: c.id, label: c.en, count: c.count }));
}
