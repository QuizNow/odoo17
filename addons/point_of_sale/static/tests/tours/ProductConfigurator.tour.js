/** @odoo-module */

import * as ProductScreen from "@point_of_sale/../tests/tours/helpers/ProductScreenTourMethods";
import * as Dialog from "@point_of_sale/../tests/tours/helpers/DialogTourMethods";
import * as Chrome from "@point_of_sale/../tests/tours/helpers/ChromeTourMethods";
import * as ProductConfigurator from "@point_of_sale/../tests/tours/helpers/ProductConfiguratorTourMethods";
import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("ProductConfiguratorTour", {
    test: true,
    url: "/pos/ui",
    steps: () =>
        [
            Dialog.confirm("Open session"),

            ProductScreen.clickShowProductsMobile(),

            // Click on Configurable Chair product
            ProductScreen.clickDisplayedProduct("Configurable Chair"),

            // Cancel configuration, not product should be in order
            Dialog.cancel(),
            ProductScreen.orderIsEmpty(),

            // Click on Configurable Chair product
            ProductScreen.clickDisplayedProduct("Configurable Chair"),

            // Pick Color
            ProductConfigurator.pickColor("Red"),

            // Pick Radio
            ProductConfigurator.pickSelect("Metal"),

            // Pick Select
            ProductConfigurator.pickRadio("Other"),

            // Fill in custom attribute
            ProductConfigurator.fillCustomAttribute("Custom Fabric"),

            // Confirm configuration
            Dialog.confirm(),

            // Check that the product has been added to the order with correct attributes and price
            ProductScreen.selectedOrderlineHas(
                "Configurable Chair (Red, Metal, Other: Custom Fabric)",
                "1.0",
                "11.0"
            ),

            // Orderlines with the same attributes should be merged
            ProductScreen.clickDisplayedProduct("Configurable Chair"),
            ProductConfigurator.pickColor("Red"),
            ProductConfigurator.pickSelect("Metal"),
            ProductConfigurator.pickRadio("Other"),
            ProductConfigurator.fillCustomAttribute("Custom Fabric"),
            Dialog.confirm(),
            ProductScreen.selectedOrderlineHas(
                "Configurable Chair (Red, Metal, Other: Custom Fabric)",
                "2.0",
                "22.0"
            ),

            // Orderlines with different attributes shouldn't be merged
            ProductScreen.clickDisplayedProduct("Configurable Chair"),
            ProductConfigurator.pickColor("Blue"),
            ProductConfigurator.pickSelect("Metal"),
            ProductConfigurator.pickRadio("Leather"),
            Dialog.confirm(),
            ProductScreen.selectedOrderlineHas(
                "Configurable Chair (Blue, Metal, Leather)",
                "1.0",
                "10.0"
            ),

            // Inactive variant attributes should not be displayed
            ProductScreen.clickDisplayedProduct("Configurable Chair"),
            // Active: Other and Leather, Inactive: Wool
            ProductConfigurator.numberRadioOptions(2),
            Dialog.confirm(),
            Chrome.endTour(),
        ].flat(),
});
