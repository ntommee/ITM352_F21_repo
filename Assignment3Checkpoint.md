---
layout: essay
type: essay
title: Assignment 3 Checkpoint
date: 2021-12-07
---

<h3>Page Design</h3>
<blockquote class="imgur-embed-pub" lang="en" data-id="a/jmIJfat" data-context="false" ><a href="//imgur.com/a/jmIJfat"></a></blockquote><script async src="//s.imgur.com/min/embed.js" charset="utf-8"></script>

<h3>Shopping Cart Design</h3>
<p>It won’t be a separate page; instead, there will be a link on every page that allows the user to be directed to the invoice page, which will act as my shopping cart. The user will be able to edit the invoice and from there, they will confirm their information and be redirected to a page that has all the confirmation information. To use the cart, it will function like the invoice. When users select the add to cart button it will store that quantity in the session. Those quantities will appear on the invoice page but with editable quantity boxes, unlike the previous invoice. Once the user is satisfied with what their cart looks like, they will confirm the quantity and proceed to the page that displays all the customer information. </p>

<h3>Sessions for Shopping Cart </h3>
<p>The items and the quantity the user selected will be stored in the cart and the cart will be stored in the session. That way when multiple users are on the website shopping, each customer will have their own session so whatever is in each person’s cart won’t be messed up. </p>
<br>

<p>“Cart”: {“20 Inch HK”: [“quantity”:2], “12 Inch HK”: [“quantity:4”]} </p>

<h3>Security Concerns</h3>
<p>Prior to accessing the final invoice confirmation page, a user must be logged in. Once a user is logged in, the session ID will be the username. With that in mind, I must check that there is a session ID that matches the saved user data before the confirmation page is able to be loaded.</p>

<h3>UI Personalization</h3>
<p>The login button on the products display page will switch to a logout *insert username here* button. In addition, the invoice/cart page will have the user’s name and email to confirm where the confirmation information will be sent.</p>

<h3>Partners</h3>
<p>I will not be working with partners.</p>

<h3>Assignment 2 vs. Assignment 3</h3>
<p>I am doing a lot more planning for Assignment 3. Especially since this assignment will not involve nearly as much coding as the previous assignments, it is crucial that I plan out the design and how I plan to execute each portion very carefully.</p>
