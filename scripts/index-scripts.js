document.addEventListener("DOMContentLoaded", () => {
    const ordersList = document.getElementById("orders-list");
    const socket = io();

    function calculateRemainingTime(createdAt, eta) {
        const now = new Date();
        const createdTime = new Date(createdAt);
        const elapsedTime = (now - createdTime) / 60000; // in minutes
        return Math.ceil(Math.max(eta - elapsedTime, 0));
    }

    function renderOrders(orders) {
        if (ordersList) {
            ordersList.innerHTML = "";
            orders.forEach((order) => {
                if (order.status !== "picked up") {
                    const li = document.createElement("li");
                    li.setAttribute("data-id", order._id);
                    li.innerHTML = `
            <div class="order-number">#${String(order.number).padStart(3, "0")}</div>
            <div class="order-time">${order.status === "preparing" ? `${calculateRemainingTime(order.createdAt, order.eta)} min` : "Ready"}</div>
            <div class="order-status">${order.status}</div>
          `;
                    li.className = order.status;
                    if (order.status === "ready") {
                        li.style.backgroundColor = "green";
                    }
                    ordersList.appendChild(li);
                    if (order.status === "preparing") {
                        startCountdown(order._id, order.createdAt, order.eta);
                    }
                }
            });
        }
    }

    function startCountdown(orderId, createdAt, eta) {
        const orderElement = document.querySelector(
            `.order-list li[data-id="${orderId}"]`,
        );
        if (!orderElement) return;

        const timeElement = orderElement.querySelector(".order-time");
        let remainingTime = calculateRemainingTime(createdAt, eta);

        const countdown = setInterval(() => {
            if (remainingTime <= 0) {
                clearInterval(countdown);
                timeElement.textContent = "Ready";
                return;
            }
            remainingTime -= 1;
            timeElement.textContent = `${remainingTime} min`;
        }, 60000);
    }

    async function fetchOrders() {
        const response = await fetch("/orders");
        const orders = await response.json();
        renderOrders(orders);
    }

    socket.on("new-order", (order) => {
        fetchOrders();
    });

    socket.on("update-order", (updatedOrder) => {
        fetchOrders();
    });

    fetchOrders();
});
