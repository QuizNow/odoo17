odoo.define('point_of_sale.ClosePosPopup', function(require) {
    'use strict';

    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');
    const { identifyError } = require('point_of_sale.utils');
    const { ConnectionLostError, ConnectionAbortedError} = require('@web/core/network/rpc_service')
    const { useRef, useState } = owl;

    class ClosePosPopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
            this.manualInputCashCount = false;
            this.moneyDetailsRef = useRef('moneyDetails');
            this.closeSessionClicked = false;
            this.moneyDetails = null;
            Object.assign(this, this.props.info)
            this.state = useState({});
            Object.assign(this.state, this.props.info.state)
        }
        openDetailsPopup() {
            if (this.moneyDetailsRef.comp.isClosed()){
                this.moneyDetailsRef.comp.openPopup();
                this.state.payments[this.defaultCashDetails.id].counted = 0;
                this.state.payments[this.defaultCashDetails.id].difference = -this.defaultCashDetails.amount;
                this.state.notes = '';
                if (this.manualInputCashCount) {
                    this.moneyDetailsRef.comp.reset();
                }
            }
        }
        handleInputChange(paymentId) {
            let expectedAmount;
            if (paymentId === this.defaultCashDetails.id) {
                this.manualInputCashCount = true;
                this.state.notes = '';
                expectedAmount = this.defaultCashDetails.amount;
            } else {
                expectedAmount = this.otherPaymentMethods.find(pm => paymentId === pm.id).amount;
            }
            this.state.payments[paymentId].difference =
                this.env.pos.round_decimals_currency(this.state.payments[paymentId].counted - expectedAmount);
            this.state.acceptClosing = false;
        }
        updateCountedCash(event) {
            const { total, moneyDetailsNotes, moneyDetails } = event.detail;
            this.state.payments[this.defaultCashDetails.id].counted = total;
            this.state.payments[this.defaultCashDetails.id].difference =
                this.env.pos.round_decimals_currency(this.state.payments[[this.defaultCashDetails.id]].counted - this.defaultCashDetails.amount);
            if (moneyDetailsNotes) {
                this.state.notes = moneyDetailsNotes;
            }
            this.manualInputCashCount = false;
            this.moneyDetails = moneyDetails;
            this.state.acceptClosing = false;
        }
        hasDifference() {
            return Object.entries(this.state.payments).find(pm => pm[1].difference != 0);
        }
        hasUserAuthority() {
            const absDifferences = Object.entries(this.state.payments).map(pm => Math.abs(pm[1].difference));
            return this.isManager || this.amountAuthorizedDiff == null || Math.max(...absDifferences) <= this.amountAuthorizedDiff;
        }
        canCloseSession() {
            return !this.cashControl || !this.hasDifference() || this.state.acceptClosing;
        }
        canCancel() {
            return true;
        }
        cancelPopup() {
            if (this.canCancel()) {
                this.cancel();
            }
        }
        closePos() {
            this.trigger('close-pos');
        }
        async closeSession() {
            if (this.canCloseSession() && !this.closeSessionClicked) {
                this.closeSessionClicked = true;
                let response;
                if (this.cashControl) {
                     response = await this.rpc({
                        model: 'pos.session',
                        method: 'post_closing_cash_details',
                        args: [this.env.pos.pos_session.id],
                        kwargs: {
                            counted_cash: this.state.payments[this.defaultCashDetails.id].counted,
                        }
                    })
                    if (!response.successful) {
                        return this.handleClosingError(response);
                    }
                }
                await this.rpc({
                    model: 'pos.session',
                    method: 'update_closing_control_state_session',
                    args: [this.env.pos.pos_session.id, this.state.notes]
                })
                try {
                    const bankPaymentMethodDiffPairs = this.otherPaymentMethods
                        .filter((pm) => pm.type == 'bank')
                        .map((pm) => [pm.id, this.state.payments[pm.id].difference]);
                    response = await this.rpc({
                        model: 'pos.session',
                        method: 'close_session_from_ui',
                        args: [this.env.pos.pos_session.id, bankPaymentMethodDiffPairs],
                        context: this.env.session.user_context,
                    });
                    if (!response.successful) {
                        return this.handleClosingError(response);
                    }
                    window.location = '/web#action=point_of_sale.action_client_pos_menu';
                } catch (error) {
                    const iError = identifyError(error);
                    if (iError instanceof ConnectionLostError || iError instanceof ConnectionAbortedError) {
                        await this.showPopup('ErrorPopup', {
                            title: this.env._t('Network Error'),
                            body: this.env._t('Cannot close the session when offline.'),
                        });
                    } else {
                        await this.showPopup('ErrorPopup', {
                            title: this.env._t('Closing session error'),
                            body: this.env._t(
                                'An error has occurred when trying to close the session.\n' +
                                'You will be redirected to the back-end to manually close the session.')
                        })
                        window.location = '/web#action=point_of_sale.action_client_pos_menu';
                    }
                }
                this.closeSessionClicked = false;
            }
        }
        async handleClosingError(response) {
            await this.showPopup('ErrorPopup', {title: 'Error', body: response.message});
            if (response.redirect) {
                window.location = '/web#action=point_of_sale.action_client_pos_menu';
            }
        }
        _getShowDiff(pm) {
            return pm.type == 'bank' && pm.number !== 0;
        }
    }

    ClosePosPopup.template = 'ClosePosPopup';
    Registries.Component.add(ClosePosPopup);

    return ClosePosPopup;
});
