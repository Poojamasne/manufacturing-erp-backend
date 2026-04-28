const pool = require("../../config/database");
const OrderModel = require("../../models/sales/orderModel");

class OrderController {
    async createOrder(req, res) {
        try {
            const {
                quotation_id,
                customer_name,
                email,
                phone,
                shipping_address,
                items,
                notes,
            } = req.body;

            if (!customer_name || !items || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Customer name and at least one item are required",
                });
            }

            const total_amount = items.reduce(
                (sum, item) => sum + item.quantity * item.unit_price,
                0,
            );

            const orderModel = new OrderModel();
            
            const orderId = await orderModel.generateOrderId();
            
            const result = await orderModel.createOrderWithTransaction(
                {
                    orderId,
                    quotation_id,
                    customer_name,
                    email,
                    phone,
                    shipping_address,
                    total_amount,
                    notes
                },
                items,
                req.user.id
            );

            res.status(201).json({
                success: true,
                message: "Order created successfully",
                data: { order_id: result.orderId, id: result.insertId },
            });
        } catch (error) {
            console.error("Error creating order:", error);
            res.status(500).json({
                success: false,
                message: "Error creating order",
                error: error.message,
            });
        }
    }

    async getAllOrders(req, res) {
        try {
            const { status, search, page = 1, limit = 10, dateRange, startDate, endDate } = req.query;

            const orderModel = new OrderModel();
            
            const { orders, parsedPage, parsedLimit } = await orderModel.getAllOrders(
                status, search, page, limit, dateRange, startDate, endDate
            );
            
            const total = await orderModel.getOrdersCount(
                status, search, dateRange, startDate, endDate
            );

            res.status(200).json({
                success: true,
                data: orders,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total: total,
                    pages: Math.ceil(total / parsedLimit)
                }
            });
        } catch (error) {
            console.error("Error fetching orders:", error);
            res.status(500).json({
                success: false,
                message: "Error fetching orders",
                error: error.message,
            });
        }
    }

    async getOrderById(req, res) {
        try {
            const { id } = req.params;

            const orderModel = new OrderModel();
            const order = await orderModel.getOrderById(id);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }

            const items = await orderModel.getOrderItems(id);

            res.status(200).json({
                success: true,
                data: { ...order, items },
            });
        } catch (error) {
            console.error("Error fetching order:", error);
            res.status(500).json({
                success: false,
                message: "Error fetching order",
                error: error.message,
            });
        }
    }

    async updateOrder(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const allowedFields = ["status", "shipping_address", "notes"];
            const updateFields = [];
            const params = [];

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    params.push(updates[field]);
                }
            }

            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "No fields to update",
                });
            }

            const orderModel = new OrderModel();
            
           
            const exists = await orderModel.checkOrderExists(id);
            if (!exists) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }
            
            await orderModel.updateOrder(id, updateFields, params);

            res.status(200).json({
                success: true,
                message: "Order updated successfully",
            });
        } catch (error) {
            console.error("Error updating order:", error);
            res.status(500).json({
                success: false,
                message: "Error updating order",
                error: error.message,
            });
        }
    }

    async deleteOrder(req, res) {
        try {
            const { id } = req.params;
            
            const orderModel = new OrderModel();
            
           
            const exists = await orderModel.checkOrderExists(id);
            if (!exists) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }
            
            await orderModel.deleteOrder(id);

            res.status(200).json({
                success: true,
                message: "Order deleted successfully",
            });
        } catch (error) {
            console.error("Error deleting order:", error);
            res.status(500).json({
                success: false,
                message: "Error deleting order",
                error: error.message,
            });
        }
    }
}

module.exports = new OrderController();