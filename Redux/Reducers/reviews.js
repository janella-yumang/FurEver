import {
    REVIEWS_REQUEST,
    REVIEWS_SUCCESS,
    REVIEWS_FAIL,
    REVIEWS_CLEAR,
} from '../constants';

const initialState = {
    byProduct: {},
    loadingByProduct: {},
    errorByProduct: {},
};

const reviews = (state = initialState, action) => {
    switch (action.type) {
        case REVIEWS_REQUEST: {
            const productId = String(action.payload?.productId || 'unknown');
            return {
                ...state,
                loadingByProduct: { ...state.loadingByProduct, [productId]: true },
                errorByProduct: { ...state.errorByProduct, [productId]: null },
            };
        }
        case REVIEWS_SUCCESS: {
            const productId = String(action.payload?.productId || 'unknown');
            return {
                ...state,
                byProduct: { ...state.byProduct, [productId]: action.payload?.reviews || [] },
                loadingByProduct: { ...state.loadingByProduct, [productId]: false },
                errorByProduct: { ...state.errorByProduct, [productId]: null },
            };
        }
        case REVIEWS_FAIL: {
            const productId = String(action.payload?.productId || 'unknown');
            return {
                ...state,
                loadingByProduct: { ...state.loadingByProduct, [productId]: false },
                errorByProduct: {
                    ...state.errorByProduct,
                    [productId]: action.payload?.error || 'Failed to load reviews',
                },
            };
        }
        case REVIEWS_CLEAR:
            return initialState;
        default:
            return state;
    }
};

export default reviews;
