import { PRODUCTS_REQUEST, PRODUCTS_SUCCESS, PRODUCTS_FAIL } from '../constants';

const initialState = {
    data: [],
    loading: false,
    error: null,
};

const products = (state = initialState, action) => {
    switch (action.type) {
        case PRODUCTS_REQUEST:
            return { ...state, loading: true, error: null };
        case PRODUCTS_SUCCESS:
            return { ...state, loading: false, data: action.payload || [], error: null };
        case PRODUCTS_FAIL:
            return { ...state, loading: false, error: action.payload || 'Failed to load products' };
        default:
            return state;
    }
};

export default products;
