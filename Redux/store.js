import { legacy_createStore as createStore, combineReducers, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';

import cartItems from './Reducers/cartItems';
import wishlistItems from './Reducers/wishlistItems';
import products from './Reducers/products';
import orders from './Reducers/orders';
import reviews from './Reducers/reviews';

const reducers = combineReducers({
    cartItems: cartItems,
    wishlistItems: wishlistItems,
    products: products,
    orders: orders,
    reviews: reviews,
})

const store = createStore(
    reducers,
    applyMiddleware(thunk)
)

export default store;