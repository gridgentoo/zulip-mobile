/* @flow */
import React from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { connect } from 'react-redux';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';

import type { Auth, Narrow, Message, Stream } from '../types';
import { OfflineNotice } from '../common';
import boundActions from '../boundActions';
import { getAnchor, getCurrentTypingUsers } from '../chat/chatSelectors';
import { getAuth } from '../account/accountSelectors';
import { canSendToNarrow, isStreamOrTopicNarrow } from '../utils/narrow';
import { filterUnreadMessageIds, countUnread } from '../utils/unread';
import { registerAppActivity } from '../utils/activity';
import { queueMarkAsRead } from '../api';
import MessageList from '../message/MessageList';
// import MessageList from '../message/MessageListWeb';
import MessageListLoading from '../message/MessageListLoading';
import NoMessages from '../message/NoMessages';
import ComposeBox from '../compose/ComposeBox';
import UnreadNotice from './UnreadNotice';
import NotSubscribed from '../message/NotSubscribed';


class Chat extends React.Component {

  static contextTypes = {
    styles: () => null,
  };

  scrollOffset: number = 0;

  props: {
    auth: Auth,
    narrow: Narrow,
    needsInitialFetch: boolean,
    fetching: { newer: boolean, older: boolean, },
    isOnline: boolean,
    flags: Object,
    messages: Message[],
    readIds: Object,
    subscriptions: any[],
    streams: Stream,
    markMessagesRead: () => void,
  };

  handleMessageListScroll = (e: Object) => {
    const { auth, flags, markMessagesRead } = this.props;
    const visibleMessageIds = e.visibleIds.map(x => +x);
    const unreadMessageIds = filterUnreadMessageIds(visibleMessageIds, flags);

    if (markMessagesRead && unreadMessageIds.length > 0) {
      markMessagesRead(unreadMessageIds);
      queueMarkAsRead(auth, unreadMessageIds);
    }

    // Calculates the amount user has scrolled up from the very bottom
    this.scrollOffset = e.contentSize.height - e.contentOffset.y - e.layoutMeasurement.height;

    registerAppActivity(auth);
  };

  isSubscribed = () => {
    const { narrow, subscriptions } = this.props;
    return isStreamOrTopicNarrow(narrow)
      ? subscriptions.find((sub) => narrow[0].operand === sub.name) !== undefined
      : true;
  }

  showSubscribeButton = () => {
    const { narrow, streams } = this.props;
    return !streams.find((sub) => narrow[0].operand === sub.name).invite_only || false;
  }

  render() {
    const { styles } = this.context;
    const { messages, narrow, fetching, isOnline, readIds, needsInitialFetch } = this.props;
    const noMessages = messages.length === 0 && !(fetching.older || fetching.newer);
    const noMessagesButLoading = messages.length === 0 && (fetching.older || fetching.newer);
    const showMessageList = !noMessages && !noMessagesButLoading;
    const unreadCount = countUnread(messages.map(msg => msg.id), readIds);
    const WrapperView = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

    return (
      <WrapperView style={styles.screen} behavior="padding">
        <UnreadNotice
          unreadCount={unreadCount}
          scrollOffset={this.scrollOffset}
          shouldOffsetForInput={canSendToNarrow(narrow)}
        />
        {!isOnline && <OfflineNotice />}
        {!needsInitialFetch && noMessages && <NoMessages narrow={narrow} />}
        {noMessagesButLoading && <MessageListLoading />}
        {showMessageList &&
        <ActionSheetProvider>
          <MessageList onScroll={this.handleMessageListScroll} {...this.props} />
        </ActionSheetProvider>}
        {canSendToNarrow(narrow) ? (this.isSubscribed() ? <ComposeBox /> :
        <NotSubscribed
          narrow={narrow}
          showSubscribeButton={this.showSubscribeButton}
        />) : null}
      </WrapperView>
    );
  }
}

export default connect(state => ({
  auth: getAuth(state),
  isOnline: state.app.isOnline,
  needsInitialFetch: state.app.needsInitialFetch,
  subscriptions: state.subscriptions,
  flags: state.flags,
  allMessages: state.chat.messages,
  fetching: state.chat.fetching,
  caughtUp: state.chat.caughtUp,
  narrow: state.chat.narrow,
  mute: state.mute,
  typingUsers: getCurrentTypingUsers(state),
  anchor: getAnchor(state),
  users: state.users,
  readIds: state.flags.read,
  twentyFourHourTime: state.realm.twentyFourHourTime,
}), boundActions)(Chat);
