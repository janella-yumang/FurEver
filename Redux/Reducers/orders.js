import { ORDERS_REQUEST, ORDERS_SUCCESS, ORDERS_FAIL } from '../constants';

const initialState = {
    data: [],
    loading: false,
    error: null,
};

const orders = (state = initialState, action) => {
    switch (action.type) {
        case ORDERS_REQUEST:
            return { ...state, loading: true, error: null };
        case ORDERS_SUCCESS:
            return { ...state, loading: false, data: action.payload || [], error: null };
        case ORDERS_FAIL:
            return { ...state, loading: false, error: action.payload || 'Failed to load orders' };
        default:
            return state;
    }
};

export default orders;
