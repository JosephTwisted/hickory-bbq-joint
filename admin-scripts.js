document.addEventListener("DOMContentLoaded", () => {
    const adminOrdersList = document.getElementById("admin-orders-list");
    const addOrderBtn = document.getElementById("add-order-btn");
    const viewAnalyticsBtn = document.getElementById("view-analytics-btn");
    const resetOrderNumberBtn = document.getElementById(
        "reset-order-number-btn",
    );
    const posModal = document.getElementById("pos-modal");
    const analyticsModal = document.getElementById("analytics-modal");
    const addonsModal = document.getElementById("addons-modal");
    const closeButtons = document.querySelectorAll(".close");
    const cartList = document.getElementById("cart-list");
    const totalPriceElement = document.getElementById("total-price");
    const etaInput = document.getElementById("eta");
    const paymentInput = document.getElementById("payment");
    const placeOrderBtn = document.getElementById("place-order-btn");
    const friesCountElement = document.getElementById("fries-count");
    const cheesyFriesCountElement =
        document.getElementById("cheesy-fries-count");
    const socket = io();

    let cart = [];

    async function fetchOrders() {
        const response = await fetch("/orders");
        const orders = await response.json();
        renderOrders(orders);
        updateFriesCount();
    }

    async function fetchAnalytics() {
        const response = await fetch("/analytics");
        const data = await response.json();
        const analyticsContent = document.getElementById("analytics-content");
        const {
            totalOrders,
            totalRevenue,
            popularItems,
            averageTimeToComplete,
            paymentMethods,
        } = data;

        analyticsContent.innerHTML = `
      <p>Total Orders: ${totalOrders}</p>
      <p>Total Revenue: €${totalRevenue.toFixed(2)}</p>
      <p>Average Time to Complete Order: ${averageTimeToComplete.toFixed(2)} minutes</p>
      ${Object.keys(popularItems)
          .map((item) => `<p>${item}: ${popularItems[item]}</p>`)
          .join("")}
    `;

        const ordersChartElement = document.getElementById("ordersChart");
        const revenueChartElement = document.getElementById("revenueChart");
        const paymentChartElement = document.getElementById("paymentChart");

        if (ordersChartElement && revenueChartElement && paymentChartElement) {
            new Chart(ordersChartElement, {
                type: "line",
                data: {
                    labels: Object.keys(popularItems),
                    datasets: [
                        {
                            label: "Total Orders",
                            data: Object.values(popularItems),
                            borderColor: "rgba(75, 192, 192, 1)",
                            borderWidth: 2,
                            fill: false,
                        },
                    ],
                },
                options: {
                    scales: {
                        x: { beginAtZero: true },
                        y: { beginAtZero: true },
                    },
                },
            });

            new Chart(revenueChartElement, {
                type: "bar",
                data: {
                    labels: ["Total Revenue"],
                    datasets: [
                        {
                            label: "Revenue (€)",
                            data: [totalRevenue],
                            backgroundColor: "rgba(54, 162, 235, 0.2)",
                            borderColor: "rgba(54, 162, 235, 1)",
                            borderWidth: 2,
                        },
                    ],
                },
                options: {
                    scales: {
                        y: { beginAtZero: true },
                    },
                },
            });

            new Chart(paymentChartElement, {
                type: "pie",
                data: {
                    labels: ["Cash", "Card"],
                    datasets: [
                        {
                            label: "Payment Methods",
                            data: [paymentMethods.cash, paymentMethods.card],
                            backgroundColor: [
                                "rgba(255, 99, 132, 0.2)",
                                "rgba(75, 192, 192, 0.2)",
                            ],
                            borderColor: [
                                "rgba(255, 99, 132, 1)",
                                "rgba(75, 192, 192, 1)",
                            ],
                            borderWidth: 2,
                        },
                    ],
                },
            });
        }
    }

    function calculateRemainingTime(createdAt, eta) {
        const now = new Date();
        const createdTime = new Date(createdAt);
        const elapsedTime = (now - createdTime) / 60000; // in minutes
        return Math.ceil(Math.max(eta - elapsedTime, 0));
    }

    function startCountdown(orderId, createdAt, eta, order) {
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
            if (remainingTime <= 2) {
                updateFriesCount();
            }
        }, 60000);
    }

    function updateFriesCount() {
        fetch("/orders")
            .then((response) => response.json())
            .then((orders) => {
                let friesCount = 0;
                let cheesyFriesCount = 0;

                orders.forEach((order) => {
                    if (order.status === "preparing") {
                        const remainingTime = calculateRemainingTime(
                            order.createdAt,
                            order.eta,
                        );
                        if (remainingTime <= 2) {
                            order.items.forEach((item) => {
                                if (
                                    item.item.toLowerCase().includes("fries") &&
                                    !item.item.toLowerCase().includes("cheesy")
                                ) {
                                    friesCount += item.quantity;
                                } else if (
                                    item.item
                                        .toLowerCase()
                                        .includes("cheesy fries")
                                ) {
                                    cheesyFriesCount += item.quantity;
                                }
                            });
                        }
                    }
                });

                friesCountElement.textContent = friesCount;
                cheesyFriesCountElement.textContent = cheesyFriesCount;
            });
    }

    function renderOrderDetails(order) {
        const details = document.createElement("div");
        details.className = "order-details";
        details.style.display = "none"; // initially hidden
        details.innerHTML = `
      <ul>
        ${order.items.map((item) => `<li>${item.item} x ${item.quantity} - €${(item.price * item.quantity).toFixed(2)}</li>`).join("")}
      </ul>
      <p>Total: €${order.items.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2)}</p>
    `;
        return details;
    }

    function renderOrders(orders) {
        if (adminOrdersList) {
            adminOrdersList.innerHTML = "";
            orders.forEach((order) => {
                if (order.status !== "picked up") {
                    const li = document.createElement("li");
                    li.setAttribute("data-id", order._id);
                    li.innerHTML = `
            <div class="order-number">#${String(order.number).padStart(3, "0")}</div>
            <div class="order-time">${order.status === "preparing" ? `${calculateRemainingTime(order.createdAt, order.eta)} min` : "Ready"}</div>
            <div class="order-status">${order.status}</div>
            <button class="dropdown-btn">Details</button>
            <div class="order-actions">
              <button class="checkmark" onclick="toggleOrderStatus('${order._id}', '${order.status}', event)">✔️</button>
              <button class="pencil" onclick="editOrder('${order._id}', ${order.number}, event)">✏️</button>
            </div>
          `;
                    li.className = order.status;
                    if (order.status === "ready") {
                        li.style.backgroundColor = "green";
                    }
                    const details = renderOrderDetails(order);
                    li.appendChild(details);
                    li.querySelector(".dropdown-btn").addEventListener(
                        "click",
                        () => {
                            details.style.display =
                                details.style.display === "none"
                                    ? "block"
                                    : "none";
                        },
                    );
                    adminOrdersList.appendChild(li);
                    if (order.status === "preparing") {
                        startCountdown(
                            order._id,
                            order.createdAt,
                            order.eta,
                            order,
                        );
                    }
                }
            });
        }
    }

    addOrderBtn.addEventListener("click", () => {
        posModal.style.display = "flex";
        document.body.classList.add("modal-open");
    });

    viewAnalyticsBtn.addEventListener("click", () => {
        analyticsModal.style.display = "flex";
        document.body.classList.add("modal-open");
        fetchAnalytics();
    });

    resetOrderNumberBtn.addEventListener("click", async () => {
        const password = prompt("Enter admin password:");
        if (password === "Tastethebliss") {
            await fetch("/reset-order-number", { method: "POST" });
            await fetch("/reset-analytics", { method: "POST" }); // Assuming a new endpoint to reset analytics
            fetchOrders();
            fetchAnalytics();
        } else {
            alert("Incorrect password!");
        }
    });

    closeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            posModal.style.display = "none";
            analyticsModal.style.display = "none";
            addonsModal.style.display = "none";
            document.body.classList.remove("modal-open");
        });
    });

    window.onclick = (event) => {
        if (event.target === posModal) {
            posModal.style.display = "none";
            document.body.classList.remove("modal-open");
        }
        if (event.target === analyticsModal) {
            analyticsModal.style.display = "none";
            document.body.classList.remove("modal-open");
        }
        if (event.target === addonsModal) {
            addonsModal.style.display = "none";
            document.body.classList.remove("modal-open");
        }
    };

    document.querySelectorAll(".menu-item").forEach((button) => {
        button.addEventListener("click", () => {
            const item = button.dataset.item;
            const price = parseFloat(button.dataset.price);
            addItemToCart(item, price);
        });
    });

    document
        .getElementById("custom-price-btn")
        .addEventListener("click", () => {
            const price = parseFloat(prompt("Enter custom price:"));
            if (!isNaN(price) && price > 0) {
                addItemToCart("Custom Item", price);
            } else {
                alert("Invalid price");
            }
        });

    function addItemToCart(item, price) {
        if (!item || isNaN(price) || price <= 0) {
            alert("Invalid item or price");
            return;
        }
        const existingItem = cart.find((cartItem) => cartItem.item === item);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ item, price, quantity: 1 });
        }
        updateCart();
    }

    function updateCart() {
        cartList.innerHTML = "";
        let totalPrice = 0;
        cart.forEach((cartItem) => {
            const li = document.createElement("li");
            li.innerHTML = `
        ${cartItem.item} x ${cartItem.quantity} - €${(cartItem.price * cartItem.quantity).toFixed(2)}
        <button onclick="updateCartItemQuantity('${cartItem.item}', 'increase')">+</button>
        <button onclick="updateCartItemQuantity('${cartItem.item}', 'decrease')">-</button>
        <button onclick="removeFromCart('${cartItem.item}')">Remove</button>
        <button onclick="openAddonsModal('${cartItem.item}', ${cartItem.price})">Add-ons</button>
      `;
            cartList.appendChild(li);
            totalPrice += cartItem.price * cartItem.quantity;
        });
        totalPriceElement.textContent = totalPrice.toFixed(2);
    }

    window.updateCartItemQuantity = (item, action) => {
        const cartItem = cart.find((cartItem) => cartItem.item === item);
        if (cartItem) {
            if (action === "increase") {
                cartItem.quantity += 1;
            } else if (action === "decrease" && cartItem.quantity > 1) {
                cartItem.quantity -= 1;
            } else if (action === "decrease" && cartItem.quantity === 1) {
                removeFromCart(item);
                return;
            }
            updateCart();
        }
    };

    window.removeFromCart = (item) => {
        cart = cart.filter((cartItem) => cartItem.item !== item);
        updateCart();
    };

    placeOrderBtn.addEventListener("click", async () => {
        const eta = parseInt(etaInput.value);
        const payment = paymentInput.value;
        if (cart.length === 0 || isNaN(eta) || !payment) {
            alert("Please complete all fields");
            return;
        }

        const order = {
            items: cart,
            eta,
            payment,
            status: "preparing",
        };
        const response = await fetch("/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(order),
        });
        if (response.ok) {
            posModal.style.display = "none";
            document.body.classList.remove("modal-open");
            cart = [];
            updateCart();
            fetchOrders();
        }
    });

    function openAddonsModal(item, price) {
        const addonsModal = document.getElementById("addons-modal");
        const addonsOptions = document.getElementById("addons-options");
        addonsOptions.innerHTML = ""; // Clear previous options

        // Define available add-ons
        const addons = [
            { name: "Egg", price: 1.5 },
            { name: "Bacon", price: 2.0 },
            { name: "Pulled Pork", price: 3.5 },
            { name: "Pulled Chicken", price: 3.5 },
            { name: "Pulled Beef", price: 3.5 },
            { name: "Cheese", price: 1.0 },
            { name: "Salad", price: 1.0 },
            { name: "Gluten Free Bun", price: 1.0 },
        ];

        // Add options to the modal
        addons.forEach((addon) => {
            const option = document.createElement("div");
            option.innerHTML = `
        <input type="checkbox" id="${addon.name}" name="addons" value="${addon.name}" data-price="${addon.price}">
        <label for="${addon.name}">${addon.name} - €${addon.price.toFixed(2)}</label>
      `;
            addonsOptions.appendChild(option);
        });

        // Open the modal
        addonsModal.style.display = "flex";
        document.body.classList.add("modal-open");

        // Confirm button logic
        document.getElementById("confirm-addons-btn").onclick = () => {
            const selectedAddons = Array.from(
                document.querySelectorAll("#addons-options input:checked"),
            ).map((checkbox) => ({
                name: checkbox.value,
                price: parseFloat(checkbox.getAttribute("data-price")),
            }));

            addAddonsToCartItem(item, selectedAddons);
            addonsModal.style.display = "none";
            document.body.classList.remove("modal-open");
        };
    }

    window.openAddonsModal = openAddonsModal;

    function addAddonsToCartItem(item, selectedAddons) {
        const cartItem = cart.find((cartItem) => cartItem.item === item);
        if (cartItem) {
            cartItem.addons = selectedAddons;
            const addonsPrice = selectedAddons.reduce(
                (total, addon) => total + addon.price,
                0,
            );
            cartItem.price += addonsPrice;
            updateCart();
        }
    }

    async function generatePDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const response = await fetch("/analytics");
        const data = await response.json();

        doc.text("Hickory BBQ Joint - Analytics Report", 20, 20);
        doc.text(`Total Orders: ${data.totalOrders}`, 20, 30);
        doc.text(`Total Revenue: €${data.totalRevenue.toFixed(2)}`, 20, 40);
        doc.text(
            `Average Time to Complete Order: ${data.averageTimeToComplete.toFixed(2)} minutes`,
            20,
            50,
        );

        Object.keys(data.popularItems).forEach((item, index) => {
            doc.text(
                `${item}: ${data.popularItems[item]}`,
                20,
                60 + index * 10,
            );
        });

        doc.save("analytics_report.pdf");
    }

    document
        .getElementById("print-pdf-btn")
        .addEventListener("click", generatePDF);

    socket.on("new-order", (order) => {
        fetchOrders();
    });

    socket.on("update-order", (updatedOrder) => {
        fetchOrders();
    });

    fetchOrders();
});

window.toggleOrderStatus = async function (id, currentStatus, event) {
    event.stopPropagation();
    let newStatus = "ready";
    if (currentStatus === "preparing") {
        newStatus = "ready";
    } else if (currentStatus === "ready") {
        newStatus = "picked up";
    }

    const response = await fetch(`/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            status: newStatus,
            completedAt: newStatus === "picked up" ? new Date() : null,
        }),
    });
    if (response.ok) {
        const updatedOrder = await response.json();
        fetchOrders();
        updateFriesCount();
    }
};

window.editOrder = async function (id, orderNumber, event) {
    event.stopPropagation();
    const newTime = prompt(
        "Enter new time in minutes (leave empty to cancel):",
    );
    if (newTime !== null && newTime !== "") {
        const parsedTime = parseInt(newTime);
        if (!isNaN(parsedTime)) {
            const response = await fetch(`/orders/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eta: parsedTime, status: "preparing" }),
            });
            if (response.ok) {
                fetchOrders();
                updateFriesCount();
            }
        } else {
            alert("Invalid time entered.");
        }
    }
};

window.fetchOrders = fetchOrders;
window.updateFriesCount = updateFriesCount;

document.addEventListener("DOMContentLoaded", () => {
    // Your existing DOMContentLoaded logic
});

// Ensure these functions are globally accessible
window.fetchOrders = fetchOrders;
window.openAddonsModal = openAddonsModal;
window.toggleOrderStatus = toggleOrderStatus;
window.editOrder = editOrder;
window.updateFriesCount = updateFriesCount;
