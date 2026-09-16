/**
 * Branded identifiers. Pure types, no runtime cost, no dependencies.
 *
 * The point is that `UserId` and `TodoId` stop being interchangeable strings,
 * so passing one where the other belongs is a compile error rather than a
 * query that quietly returns nothing.
 */
declare const userIdBrand: unique symbol;

export type UserId = string & { readonly [userIdBrand]: true };

declare const todoIdBrand: unique symbol;

export type TodoId = string & { readonly [todoIdBrand]: true };
