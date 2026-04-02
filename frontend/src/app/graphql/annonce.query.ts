import { gql } from 'apollo-angular';

/** Champs alignés sur `Item` (backend `annonce.entity.ts`) — pas `annonces`. */
const ITEM_FIELDS = `
  id
  title
  description
  category
  photos
  location {
    lat
    lng
    addr
  }
  status
  suggestedCategory
  fraudScore
  createdAt
  expiresAt
  quantity
  priceType
  priceValue
  owner {
    id
    displayName
    email
    points
    badges
    trustScore
  }
`;

export const GET_ANNONCES = gql`
  query GetItems {
    items {
      ${ITEM_FIELDS}
    }
  }
`;

export const GET_ANNONCE_BY_ID = gql`
  query GetItem($id: String!) {
    item(id: $id) {
      ${ITEM_FIELDS}
    }
  }
`;

export const GET_ANNONCES_BY_CATEGORY = gql`
  query GetItemsByCategory($category: String!) {
    itemsByCategory(category: $category) {
      ${ITEM_FIELDS}
    }
  }
`;

export const GET_ANNONCES_BY_STATUS = gql`
  query GetItemsByStatus($status: ItemStatus!) {
    itemsByStatus(status: $status) {
      ${ITEM_FIELDS}
    }
  }
`;

export const GET_ANNONCES_BY_OWNER_ID = gql`
  query GetItemsByOwnerId($ownerId: String!) {
    itemsByOwnerId(ownerId: $ownerId) {
      ${ITEM_FIELDS}
    }
  }
`;
